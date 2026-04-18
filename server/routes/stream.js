const express = require("express");
const router = express.Router();
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET } = require("../config/storage");

function proxyWasabi(key, contentType, cacheSeconds, req, res) {
  s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    .then((result) => {
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", `public, max-age=${cacheSeconds}`);
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (result.ContentLength) res.setHeader("Content-Length", result.ContentLength);
      result.Body.on("error", () => res.destroy());
      result.Body.pipe(res);
    })
    .catch((err) => {
      const status = err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404 ? 404 : 500;
      console.error(`Stream proxy error [${status}] key=${key}:`, err.message);
      res.status(status).end();
    });
}

// GET /api/stream/thumbnails/:filename  — thumbnail proxy
router.get("/thumbnails/:filename", (req, res) => {
  const { filename } = req.params;
  if (!/^[\w.-]+$/.test(filename)) return res.status(400).end();
  const ext = filename.split(".").pop().toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  proxyWasabi(`thumbnails/${filename}`, mime, 86400, req, res);
});

// GET /api/stream/:videoId/:filename  — HLS proxy
router.get("/:videoId/:filename", (req, res) => {
  const { videoId, filename } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(videoId) || !/^[\w.-]+$/.test(filename)) {
    return res.status(400).end();
  }
  const mime = filename.endsWith(".m3u8") ? "application/x-mpegURL" : "video/MP2T";
  proxyWasabi(`videos/${videoId}/${filename}`, mime, 3600, req, res);
});

module.exports = router;
