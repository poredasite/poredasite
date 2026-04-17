const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { pipeline } = require("stream/promises");
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3, BUCKET, CDN_URL } = require("../config/storage");

function getVideoDuration(inputPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, meta) => {
      resolve(err ? 0 : Math.round(meta.format.duration || 0));
    });
  });
}

function convertToHLS(inputPath, videoId) {
  const outputDir = path.join(os.tmpdir(), `hls-${videoId}`);
  fs.mkdirSync(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",
        "-crf 22",
        "-preset fast",
        "-c:a aac",
        "-b:a 128k",
        "-hls_time 6",
        "-hls_list_size 0",
        `-hls_segment_filename ${path.join(outputDir, "seg%03d.ts")}`,
        "-f hls",
      ])
      .output(path.join(outputDir, "index.m3u8"))
      .on("end", () => resolve(outputDir))
      .on("error", reject)
      .run();
  });
}

async function uploadHLSToWasabi(outputDir, videoId) {
  const files = fs.readdirSync(outputDir);
  for (const file of files) {
    const filePath = path.join(outputDir, file);
    const key = `videos/${videoId}/${file}`;
    const contentType = file.endsWith(".m3u8") ? "application/x-mpegURL" : "video/MP2T";
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fs.readFileSync(filePath),
      ContentType: contentType,
    }));
  }
  fs.rmSync(outputDir, { recursive: true, force: true });
  return `${CDN_URL}/videos/${videoId}/index.m3u8`;
}

async function uploadThumbnailToWasabi(filePath, videoId, mimeType) {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const key = `thumbnails/${videoId}.${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fs.readFileSync(filePath),
    ContentType: mimeType,
  }));
  return { url: `${CDN_URL}/${key}`, key };
}

async function createRawUploadUrl(videoId, contentType) {
  const extMap = {
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "video/avi": "avi", "video/x-matroska": "mkv",
  };
  const ext = extMap[contentType] || "mp4";
  const key = `raw/${videoId}.${ext}`;
  const url = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: BUCKET, Key: key, ContentType: contentType,
  }), { expiresIn: 7200 });
  return { url, key };
}

async function downloadRawFromWasabi(key, destPath) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  await pipeline(res.Body, fs.createWriteStream(destPath));
}

async function deleteRawFromWasabi(key) {
  try { await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })); } catch {}
}

async function deleteFromWasabi(prefix) {
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  if (!listed.Contents?.length) return;
  await s3.send(new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: { Objects: listed.Contents.map((o) => ({ Key: o.Key })) },
  }));
}

module.exports = { getVideoDuration, convertToHLS, uploadHLSToWasabi, uploadThumbnailToWasabi, deleteFromWasabi, createRawUploadUrl, downloadRawFromWasabi, deleteRawFromWasabi };
