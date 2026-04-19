"use strict";
const ffmpeg  = require("fluent-ffmpeg");
const path    = require("path");
const fs      = require("fs");
const os      = require("os");
const { pipeline } = require("stream/promises");
const {
  PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  DeleteObjectsCommand, ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3, BUCKET, CDN_URL } = require("../config/storage");

// ── Probe ─────────────────────────────────────────────────────────────────────

function getVideoDuration(inputPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, meta) => {
      resolve(err ? 0 : Math.round(meta.format.duration || 0));
    });
  });
}

function extractCodecInfo(inputPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, meta) => {
      if (err) return resolve({});
      const v = meta.streams?.find((s) => s.codec_type === "video");
      const a = meta.streams?.find((s) => s.codec_type === "audio");
      resolve({
        videoCodec: v?.codec_name || "",
        audioCodec: a?.codec_name || "",
        profile:    v?.profile    || "",
        level:      v?.level != null ? String(v.level) : "",
      });
    });
  });
}

// ── Streaming R2 upload (no readFileSync — zero RAM spike for large files) ────
async function streamUpload(key, filePath, contentType) {
  const stat = fs.statSync(filePath);
  await s3.send(new PutObjectCommand({
    Bucket:        BUCKET,
    Key:           key,
    Body:          fs.createReadStream(filePath),
    ContentType:   contentType,
    ContentLength: stat.size,
  }));
}

// ── HLS encode ────────────────────────────────────────────────────────────────

function convertToHLS(inputPath, videoId) {
  const outputDir = path.join(os.tmpdir(), `hls-${videoId}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const gpu = process.env.FFMPEG_GPU;
  const videoCodec = gpu === "nvenc" ? "h264_nvenc"
                   : gpu === "amf"   ? "h264_amf"
                   : gpu === "qsv"   ? "h264_qsv"
                   : "libx264";

  // GPU-specific quality opts; CPU path uses CRF 22 veryfast
  // Level 4.1 = max 1080p@30fps accepted by all browser MSE stacks
  const qualityOpts = gpu === "nvenc"
    ? ["-rc vbr", "-cq 22", "-preset p2", "-profile:v main", "-level 4.1"]
    : gpu === "amf"
    ? ["-quality speed", "-qp_i 22", "-qp_p 22", "-profile:v main", "-level 4.1"]
    : gpu === "qsv"
    ? ["-global_quality 22", "-preset veryfast", "-profile:v main", "-level 4.1"]
    : ["-crf 22", "-preset veryfast", "-profile:v main", "-level 4.1"];

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-c:v ${videoCodec}`,
        ...qualityOpts,
        "-pix_fmt yuv420p",            // 8-bit 4:2:0 — required for browser MSE
        "-force_key_frames expr:gte(t,n_forced*6)",  // IDR at every segment start
        "-sc_threshold 0",             // no scene-change keyframes (CPU path only, GPU ignores)
        "-c:a aac", "-b:a 128k", "-ar 48000", "-ac 2",  // stereo 48kHz — 5.1/44.1 breaks web MSE
        "-hls_time 6",
        "-hls_list_size 0",
        "-hls_flags independent_segments+delete_segments+temp_file",
        `-hls_segment_filename ${path.join(outputDir, "seg%03d.ts")}`,
        "-f hls",
      ])
      .output(path.join(outputDir, "index.m3u8"))
      .on("end",   () => resolve(outputDir))
      .on("error", reject)
      .run();
  });
}

// ── Parallel HLS upload — the single biggest perf win over the old sequential for-loop ──
// Uploads up to BATCH_SIZE segments concurrently; drains disk as segments appear.

async function uploadHLSParallel(outputDir, videoId, batchSize = 8) {
  const files = fs.readdirSync(outputDir);

  // Process in batches to avoid hitting R2 rate limits or OOM on huge segment lists
  for (let i = 0; i < files.length; i += batchSize) {
    await Promise.all(
      files.slice(i, i + batchSize).map(async (file) => {
        const filePath    = path.join(outputDir, file);
        const key         = `videos/${videoId}/${file}`;
        const contentType = file.endsWith(".m3u8")
          ? "application/vnd.apple.mpegurl"
          : "video/mp2t";
        await streamUpload(key, filePath, contentType);
      })
    );
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  return `${CDN_URL}/videos/${videoId}/index.m3u8`;
}

// Legacy sequential upload — kept for reference / fallback
async function uploadHLSToStorage(outputDir, videoId) {
  return uploadHLSParallel(outputDir, videoId, 1);
}

// ── Fast preview (PornHub-style highlight montage) ────────────────────────────
// 5 × 2s clips from 15%–85% of video → 10s silent preview
// ultrafast preset + CRF 30 + 640px → typically done in <60s

function generatePreviewClip(inputPath, videoId, duration) {
  const outPath = path.join(os.tmpdir(), `preview-${videoId}.mp4`);
  const dur     = duration || 60;
  const CLIPS   = 5;
  const CLIP_DUR = 2;

  const points = Array.from({ length: CLIPS }, (_, i) => {
    const pct = 0.15 + (i / (CLIPS - 1)) * 0.70;
    return Math.floor(dur * pct);
  });

  const filterParts   = points.map((t, i) =>
    `[0:v]trim=start=${t}:duration=${CLIP_DUR},setpts=PTS-STARTPTS,scale=640:-2[c${i}]`
  );
  const concatInputs  = points.map((_, i) => `[c${i}]`).join("");
  const filterComplex = [
    ...filterParts,
    `${concatInputs}concat=n=${CLIPS}:v=1:a=0[out]`,
  ].join(";");

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-filter_complex", filterComplex,
        "-map", "[out]",
        "-c:v libx264",
        "-profile:v main", "-level 4.1",
        "-crf 30",
        "-preset ultrafast",   // ← fastest possible; preview quality is acceptable
        "-pix_fmt yuv420p",
        "-an",
        "-movflags +faststart",
      ])
      .output(outPath)
      .on("end",   () => resolve(outPath))
      .on("error", reject)
      .run();
  });
}

// ── MP4 fallback ──────────────────────────────────────────────────────────────
// Compact progressive MP4 for environments where HLS.js fails (old Safari, some bots)
// CRF 26 veryfast → reasonable quality, fast encode

function generateMp4Fallback(inputPath, videoId) {
  const outPath = path.join(os.tmpdir(), `fallback-${videoId}.mp4`);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",
        "-profile:v baseline", "-level 3.1",   // widest device compatibility
        "-crf 26",
        "-preset veryfast",
        "-pix_fmt yuv420p",
        "-c:a aac", "-b:a 128k",
        "-movflags +faststart",                 // moov atom at front → instant play
      ])
      .output(outPath)
      .on("end",   () => resolve(outPath))
      .on("error", reject)
      .run();
  });
}

// ── Storage helpers ───────────────────────────────────────────────────────────

async function uploadPreviewToStorage(filePath, videoId) {
  const key = `previews/${videoId}.mp4`;
  await streamUpload(key, filePath, "video/mp4");
  try { fs.unlinkSync(filePath); } catch {}
  return `${CDN_URL}/${key}`;
}

async function uploadMp4FallbackToStorage(filePath, videoId) {
  const key = `fallback/${videoId}.mp4`;
  await streamUpload(key, filePath, "video/mp4");
  try { fs.unlinkSync(filePath); } catch {}
  return `${CDN_URL}/${key}`;
}

async function uploadThumbnailToStorage(filePath, videoId, mimeType) {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const key = `thumbnails/${videoId}.${ext}`;
  await streamUpload(key, filePath, mimeType);
  return { url: `${CDN_URL}/${key}`, key };
}

async function createRawUploadUrl(videoId, contentType) {
  const extMap = {
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "video/avi": "avi", "video/x-matroska": "mkv",
  };
  const ext = extMap[contentType] || "mp4";
  const key = `raw/${videoId}.${ext}`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 7200 }
  );
  return { url, key };
}

async function downloadRawFromStorage(key, destPath) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  await pipeline(res.Body, fs.createWriteStream(destPath));
}

async function deleteRawFromStorage(key) {
  try { await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })); } catch {}
}

async function deleteFromStorage(prefix) {
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  if (!listed.Contents?.length) return;
  await s3.send(new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: { Objects: listed.Contents.map((o) => ({ Key: o.Key })) },
  }));
}

module.exports = {
  getVideoDuration, extractCodecInfo,
  convertToHLS,
  uploadHLSToStorage,     // legacy alias
  uploadHLSParallel,      // new parallel upload
  generatePreviewClip,    uploadPreviewToStorage,
  generateMp4Fallback,    uploadMp4FallbackToStorage,
  uploadThumbnailToStorage,
  createRawUploadUrl,
  downloadRawFromStorage, deleteRawFromStorage,
  deleteFromStorage,
};
