"use strict";
const ffmpeg      = require("fluent-ffmpeg");
const ffmpegPath  = require("ffmpeg-static");
const path        = require("path");

// Use bundled binary when system FFmpeg is not on PATH (Railway, Docker, etc.)
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
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
    // All uploaded assets are immutable (new videoId = new key, never overwritten).
    // This tells Cloudflare CDN to cache forever at the edge.
    CacheControl:  "public, max-age=31536000, immutable",
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
        "-vf scale=-2:'min(ih,720)'",  // cap at 720p — halves frame buffer RAM
        "-pix_fmt yuv420p",
        "-threads 1",                  // single-threaded → ~50% less RAM, Railway-safe
        "-force_key_frames expr:gte(t,n_forced*6)",
        "-sc_threshold 0",
        "-c:a aac", "-b:a 128k", "-ar 48000", "-ac 2",
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

// Encodes one 2-second clip from inputPath at seekTime → tmp file
function encodeClip(inputPath, outPath, seekTime, clipDur = 2) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(seekTime)
      .duration(clipDur)
      .outputOptions([
        "-c:v libx264", "-profile:v main", "-level 4.1",
        "-crf 28", "-preset ultrafast",
        "-vf scale=640:-2,setpts=PTS-STARTPTS",  // reset pts so concat timestamps are continuous
        "-pix_fmt yuv420p",
        "-threads 1", "-an",
        "-reset_timestamps 1",
      ])
      .output(outPath)
      .on("end",   () => resolve(outPath))
      .on("error", reject)
      .run();
  });
}

// Concatenates pre-encoded clip files using concat demuxer (sequential read, low RAM)
function concatClips(clipPaths, outPath) {
  const listFile = outPath + ".txt";
  fs.writeFileSync(listFile, clipPaths.map(p => `file '${p}'`).join("\n"));
  return new Promise((resolve, reject) => {
    ffmpeg(listFile)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy", "-movflags +faststart"])
      .output(outPath)
      .on("end", () => { try { fs.unlinkSync(listFile); } catch {} resolve(outPath); })
      .on("error", (e) => { try { fs.unlinkSync(listFile); } catch {} reject(e); })
      .run();
  });
}

async function generatePreviewClip(inputPath, videoId, duration) {
  const outPath  = path.join(os.tmpdir(), `preview-${videoId}.mp4`);
  const dur      = duration || 0;

  // Too short to montage — take a single 10s clip from 20% in
  if (dur < 30) {
    const seekTo = dur > 10 ? Math.floor(dur * 0.2) : 0;
    const clipDur = Math.min(10, Math.max(dur - seekTo - 0.5, 1));
    await encodeClip(inputPath, outPath, seekTo, clipDur);
    return outPath;
  }

  // Normal: 5 × 2s clips evenly spread between 15%–85%
  const CLIPS    = 5;
  const CLIP_DUR = Math.min(2, Math.floor(dur * 0.06)); // scale clip length for short-ish vids
  const points   = Array.from({ length: CLIPS }, (_, i) => {
    const pct = 0.15 + (i / (CLIPS - 1)) * 0.70;
    return Math.floor(dur * pct);
  }).filter(t => t + CLIP_DUR < dur); // drop points that would run past end

  if (points.length === 0) {
    await encodeClip(inputPath, outPath, 0, Math.min(10, dur - 0.5));
    return outPath;
  }

  const clipPaths = [];
  try {
    for (let i = 0; i < points.length; i++) {
      const clipPath = path.join(os.tmpdir(), `clip-${videoId}-${i}.mp4`);
      await encodeClip(inputPath, clipPath, points[i], CLIP_DUR);
      clipPaths.push(clipPath);
    }
    await concatClips(clipPaths, outPath);
  } finally {
    for (const p of clipPaths) try { fs.unlinkSync(p); } catch {}
  }

  return outPath;
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
        "-profile:v baseline", "-level 3.1",
        "-crf 26",
        "-preset veryfast",
        "-vf scale=-2:'min(ih,720)'",
        "-pix_fmt yuv420p",
        "-threads 1",
        "-c:a aac", "-b:a 128k",
        "-movflags +faststart",
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

function extractThumbnailFrame(inputPath, videoId, timeSeconds) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(os.tmpdir(), `thumb-auto-${videoId}-${Date.now()}.jpg`);
    ffmpeg(inputPath)
      .seekInput(Math.max(0, timeSeconds))
      .frames(1)
      .outputOptions(["-vf", "scale=1280:-2", "-q:v", "3"])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}

async function uploadThumbnailToStorage(filePath, videoId, mimeType) {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : mimeType.includes("avif") ? "avif" : "jpg";
  const key = `thumbnails/${videoId}.${ext}`;
  await streamUpload(key, filePath, mimeType);
  return { url: `${CDN_URL}/${key}`, key };
}

async function createRawUploadUrl(videoId, contentType) {
  const extMap = {
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "video/avi": "avi", "video/x-matroska": "mkv", "video/mp2t": "ts",
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
  extractThumbnailFrame,
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
