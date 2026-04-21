const express = require("express");
const router = express.Router();
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET } = require("../config/storage");

// All proxied assets are immutable (keyed by videoId — never overwritten)
const IMMUTABLE = "public, max-age=31536000, immutable";

function proxyR2(key, contentType, req, res) {
  const commandInput = { Bucket: BUCKET, Key: key };
  const rangeHeader = req.headers.range;
  if (rangeHeader) commandInput.Range = rangeHeader;

  s3.send(new GetObjectCommand(commandInput))
    .then((result) => {
      const status = rangeHeader ? 206 : 200;
      res.status(status);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", IMMUTABLE);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Accept-Ranges", "bytes");
      if (result.ContentLength) res.setHeader("Content-Length", result.ContentLength);
      if (result.ContentRange) res.setHeader("Content-Range", result.ContentRange);
      result.Body.on("error", () => res.destroy());
      result.Body.pipe(res);
    })
    .catch((err) => {
      const status = err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404 ? 404 : 500;
      console.error(`Stream proxy error [${status}] key=${key}:`, err.message);
      res.status(status).end();
    });
}

// GET /api/stream/thumbnails/:filename
router.get("/thumbnails/:filename", (req, res) => {
  const { filename } = req.params;
  if (!/^[\w.-]+$/.test(filename)) return res.status(400).end();
  const ext = filename.split(".").pop().toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  proxyR2(`thumbnails/${filename}`, mime, req, res);
});

// GET /api/stream/previews/:videoId  — preview MP4 proxy with range support
router.get("/previews/:videoId", (req, res) => {
  const { videoId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(videoId)) return res.status(400).end();
  proxyR2(`previews/${videoId}.mp4`, "video/mp4", req, res);
});

// GET /api/stream/fallback/:videoId  — MP4 fallback proxy with range support
router.get("/fallback/:videoId", (req, res) => {
  const { videoId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(videoId)) return res.status(400).end();
  proxyR2(`fallback/${videoId}.mp4`, "video/mp4", req, res);
});

// GET /api/stream/:videoId/:filename  — HLS segments proxy
router.get("/:videoId/:filename", (req, res) => {
  const { videoId, filename } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(videoId) || !/^[\w.-]+$/.test(filename)) {
    return res.status(400).end();
  }
  const mime = filename.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
  proxyR2(`videos/${videoId}/${filename}`, mime, req, res);
});

module.exports = router;
