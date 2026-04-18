const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { pipeline } = require("stream/promises");
const {
  PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  DeleteObjectsCommand, ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
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

  // GPU mode: set FFMPEG_GPU=nvenc (NVIDIA) | amf (AMD) | qsv (Intel)
  // GPU sadece lokal sunucuda çalışır, Railway'de CPU kullanılır
  const gpu = process.env.FFMPEG_GPU;
  const videoCodec = gpu === "nvenc" ? "h264_nvenc"
                   : gpu === "amf"   ? "h264_amf"
                   : gpu === "qsv"   ? "h264_qsv"
                   : "libx264";

  const qualityOpts = gpu === "nvenc" ? ["-rc vbr", "-cq 22", "-preset p2"]
                    : gpu === "amf"   ? ["-quality speed", "-qp_i 22", "-qp_p 22"]
                    : gpu === "qsv"   ? ["-global_quality 22", "-preset veryfast"]
                    : ["-crf 22", "-preset veryfast"];

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-c:v ${videoCodec}`,
        ...qualityOpts,
        "-profile:v main", // Force main profile for better browser compatibility
        "-pix_fmt yuv420p", // FORCE 8-bit pixel format (Web tarayıcıları 10-bit/HDR videolarda hata verir)
        "-c:a aac", "-b:a 128k",
        "-hls_time 6", "-hls_list_size 0",
        `-hls_segment_filename ${path.join(outputDir, "seg%03d.ts")}`,
        "-f hls",
      ])
      .output(path.join(outputDir, "index.m3u8"))
      .on("end", () => resolve(outputDir))
      .on("error", reject)
      .run();
  });
}

// PornHub tarzı highlight preview: videonun 5 farklı noktasından 2'şer saniyelik kesit → 10sn montaj
function generatePreviewClip(inputPath, videoId, duration) {
  const outPath = path.join(os.tmpdir(), `preview-${videoId}.mp4`);
  const dur = duration || 60;

  // Videonun %15-%85'i arasında 5 eşit nokta (intro ve outro atlanıyor)
  const CLIPS = 5;
  const CLIP_DUR = 2;
  const points = Array.from({ length: CLIPS }, (_, i) => {
    const pct = 0.15 + (i / (CLIPS - 1)) * 0.70;
    return Math.floor(dur * pct);
  });

  // Her nokta için: trim → PTS sıfırla → scale
  const filterParts = points.map((t, i) =>
    `[0:v]trim=start=${t}:duration=${CLIP_DUR},setpts=PTS-STARTPTS,scale=640:-2[c${i}]`
  );
  const concatInputs = points.map((_, i) => `[c${i}]`).join("");
  const filterComplex = [
    ...filterParts,
    `${concatInputs}concat=n=${CLIPS}:v=1:a=0[out]`,
  ].join(";");

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-filter_complex ${filterComplex}`,
        "-map [out]",
        "-c:v libx264",
        "-crf 30",
        "-preset veryfast",
        "-an",
        "-movflags +faststart",
      ])
      .output(outPath)
      .on("end", () => resolve(outPath))
      .on("error", reject)
      .run();
  });
}

async function uploadPreviewToStorage(filePath, videoId) {
  const key = `previews/${videoId}.mp4`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fs.readFileSync(filePath),
    ContentType: "video/mp4",
  }));
  fs.unlinkSync(filePath);
  return `${CDN_URL}/${key}`;
}

async function uploadHLSToStorage(outputDir, videoId) {
  const files = fs.readdirSync(outputDir);
  for (const file of files) {
    const filePath = path.join(outputDir, file);
    const key = `videos/${videoId}/${file}`;
    const contentType = file.endsWith(".m3u8") ? "application/x-mpegURL" : "video/MP2T";
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: key,
      Body: fs.readFileSync(filePath),
      ContentType: contentType,
    }));
  }
  fs.rmSync(outputDir, { recursive: true, force: true });
  return `${CDN_URL}/videos/${videoId}/index.m3u8`;
}

async function uploadThumbnailToStorage(filePath, videoId, mimeType) {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const key = `thumbnails/${videoId}.${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key,
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
  getVideoDuration, convertToHLS,
  uploadHLSToStorage, uploadThumbnailToStorage,
  generatePreviewClip, uploadPreviewToStorage,
  createRawUploadUrl, downloadRawFromStorage,
  deleteRawFromStorage, deleteFromStorage,
};
