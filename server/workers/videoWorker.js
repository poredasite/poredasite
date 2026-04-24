"use strict";
const { Worker } = require("bullmq");
const path        = require("path");
const fs          = require("fs");
const os          = require("os");

const Video   = require("../models/Video");
const sitemap = require("../services/sitemapService");
const { getRedis } = require("../queue/index");
const {
  getVideoDuration, extractCodecInfo,
  extractThumbnailFrame,
  convertToHLS,    uploadHLSParallel,
  generatePreviewClip, uploadPreviewToStorage,
  generateMp4Fallback, uploadMp4FallbackToStorage,
  uploadThumbnailToStorage,
  downloadRawFromStorage, deleteRawFromStorage,
} = require("../utils/hls");
const { processWhisperSubtitles } = require("../utils/whisper");

// ── Env config ────────────────────────────────────────────────────────────────
const CONCURRENCY     = parseInt(process.env.WORKER_CONCURRENCY) || 4;
const PARALLEL_ENCODE = process.env.PARALLEL_ENCODE !== "false";    // default ON for 48 vCPU hobby plan

// ── Helpers ───────────────────────────────────────────────────────────────────
function cleanup(...paths) {
  for (const p of paths) {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  }
}

// ── Main processor ────────────────────────────────────────────────────────────
async function processVideoJob(job) {
  const { videoId, rawKey, enableWhisper } = job.data;
  const ext     = path.extname(rawKey) || ".mp4";
  const tmpPath = path.join(os.tmpdir(), `raw-${videoId}-${job.id}${ext}`);

  try {
    // ── PHASE 1: Probe + fast preview ────────────────────────────────────────
    await job.updateProgress(5);

    console.log(`[Worker:${job.id}] Downloading raw → ${tmpPath}`);
    await downloadRawFromStorage(rawKey, tmpPath);

    await job.updateProgress(12);

    const [duration, codecInfo] = await Promise.all([
      getVideoDuration(tmpPath),
      extractCodecInfo(tmpPath),
    ]);
    console.log(`[Worker:${job.id}] Probed: ${duration}s | codec: ${codecInfo.videoCodec}`);

    await job.updateProgress(15);

    // Auto-generate thumbnail if none was uploaded
    const videoDoc = await Video.findById(videoId).select("thumbnailUrl").lean();
    if (!videoDoc?.thumbnailUrl) {
      try {
        const thumbTime = Math.max(1, Math.floor(duration / 2));
        const thumbPath = await extractThumbnailFrame(tmpPath, videoId, thumbTime);
        const { url: thumbUrl, key: thumbKey } = await uploadThumbnailToStorage(thumbPath, videoId, "image/jpeg");
        try { fs.unlinkSync(thumbPath); } catch {}
        await Video.findByIdAndUpdate(videoId, { thumbnailUrl: thumbUrl, thumbnailPublicId: thumbKey });
        console.log(`[Worker:${job.id}] Auto-thumbnail @ ${thumbTime}s → ${thumbUrl}`);
      } catch (e) {
        console.error(`[Worker:${job.id}] Auto-thumbnail failed (non-fatal):`, e.message);
      }
    }

    // Fast preview: ultrafast preset, 640px, no audio → done in ~30s for most files
    let previewUrl = null;
    try {
      const previewPath = await generatePreviewClip(tmpPath, `${videoId}-${job.id}`, duration);
      await job.updateProgress(35);

      previewUrl = await uploadPreviewToStorage(previewPath, videoId);

      // Mark "uploaded" — frontend can play preview immediately, HLS still encoding
      await Video.findByIdAndUpdate(videoId, {
        previewVideoUrl: previewUrl,
        duration,
        codecInfo,
        status: "uploaded",
      });
      console.log(`[Worker:${job.id}] Preview live → ${previewUrl}`);
    } catch (e) {
      console.error(`[Worker:${job.id}] Preview skipped:`, e.message);
      // Non-fatal: continue to HLS
    }

    await job.updateProgress(40);

    // ── PHASE 2: Full encode ──────────────────────────────────────────────────
    let hlsOutputDir  = null;
    let mp4FallbackPath = null;

    if (PARALLEL_ENCODE) {
      // Two FFmpeg processes in parallel — good for 4+ vCPU environments
      [hlsOutputDir, mp4FallbackPath] = await Promise.all([
        convertToHLS(tmpPath, videoId),
        generateMp4Fallback(tmpPath, videoId).catch((e) => {
          console.error(`[Worker:${job.id}] MP4 fallback encode failed:`, e.message);
          return null;
        }),
      ]);
    } else {
      // Sequential — safe for 1–2 vCPU (Railway free/starter)
      hlsOutputDir    = await convertToHLS(tmpPath, videoId);
      mp4FallbackPath = await generateMp4Fallback(tmpPath, videoId).catch((e) => {
        console.error(`[Worker:${job.id}] MP4 fallback encode failed:`, e.message);
        return null;
      });
    }

    await job.updateProgress(80);

    // ── PHASE 3: Parallel R2 upload ───────────────────────────────────────────
    const [hlsUrl, mp4FallbackUrl] = await Promise.all([
      uploadHLSParallel(hlsOutputDir, videoId),
      mp4FallbackPath
        ? uploadMp4FallbackToStorage(mp4FallbackPath, videoId).catch((e) => {
            console.error(`[Worker:${job.id}] MP4 fallback upload failed:`, e.message);
            return null;
          })
        : Promise.resolve(null),
    ]);

    await job.updateProgress(95);

    // ── PHASE 4: Whisper subtitles (optional) ────────────────────────────────
    let subtitleUrl = null;
    if (enableWhisper) {
      try {
        console.log(`[Worker:${job.id}] Starting Whisper subtitle generation…`);
        subtitleUrl = await processWhisperSubtitles(tmpPath, videoId);
        console.log(`[Worker:${job.id}] Subtitles ready → ${subtitleUrl}`);
      } catch (e) {
        console.error(`[Worker:${job.id}] Whisper failed (non-fatal):`, e.message);
      }
    }

    // ── PHASE 5: Finalize ─────────────────────────────────────────────────────
    cleanup(tmpPath);
    await deleteRawFromStorage(rawKey).catch(() => {});
    sitemap.invalidateCache();

    await Video.findByIdAndUpdate(videoId, {
      videoUrl:     hlsUrl,
      duration,
      codecInfo,
      rawVideoKey:  null,
      status:       "ready",
      ...(previewUrl     ? { previewVideoUrl: previewUrl }    : {}),
      ...(mp4FallbackUrl ? { mp4FallbackUrl }                  : {}),
      ...(subtitleUrl    ? { subtitleUrl }                     : {}),
    });

    await job.updateProgress(100);
    console.log(`✅ [Worker:${job.id}] Ready: ${videoId} | HLS: ${hlsUrl}`);

  } catch (err) {
    cleanup(tmpPath);
    // Only set error on final attempt — let BullMQ retry first
    if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
      await Video.findByIdAndUpdate(videoId, { status: "error" }).catch(() => {});
      console.error(`❌ [Worker:${job.id}] Final failure for ${videoId}:`, err.message);
    } else {
      console.warn(`⚠️ [Worker:${job.id}] Attempt ${job.attemptsMade + 1} failed, will retry:`, err.message);
    }
    throw err;
  }
}

// ── Create worker ─────────────────────────────────────────────────────────────
function createWorker() {
  const worker = new Worker("video-processing", processVideoJob, {
    connection:  getRedis(),
    concurrency: CONCURRENCY,
  });

  worker.on("completed", (job) => {
    console.log(`[BullMQ] ✅ Job ${job.id} done (videoId: ${job.data.videoId})`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[BullMQ] ❌ Job ${job?.id} failed attempt ${job?.attemptsMade}/${job?.opts?.attempts}:`,
      err.message
    );
  });

  worker.on("error", (err) => {
    console.error("[BullMQ] Worker error:", err.message);
  });

  return worker;
}

module.exports = { createWorker };
