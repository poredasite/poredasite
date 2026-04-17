const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
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

async function deleteFromWasabi(prefix) {
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  if (!listed.Contents?.length) return;
  await s3.send(new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: { Objects: listed.Contents.map((o) => ({ Key: o.Key })) },
  }));
}

module.exports = { getVideoDuration, convertToHLS, uploadHLSToWasabi, uploadThumbnailToWasabi, deleteFromWasabi };
