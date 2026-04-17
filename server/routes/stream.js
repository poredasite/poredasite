const express = require("express");
const router = express.Router();
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET } = require("../config/storage");

// GET /api/stream/:videoId/:filename  — proxies HLS files from Wasabi
router.get("/:videoId/:filename", async (req, res) => {
  const { videoId, filename } = req.params;

  if (!/^[a-zA-Z0-9_-]+$/.test(videoId) || !/^[\w.-]+$/.test(filename)) {
    return res.status(400).end();
  }

  const key = `videos/${videoId}/${filename}`;
  const contentType = filename.endsWith(".m3u8")
    ? "application/x-mpegURL"
    : filename.endsWith(".ts")
    ? "video/MP2T"
    : "application/octet-stream";

  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    result.Body.pipe(res);
  } catch (err) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).end();
    }
    console.error("Stream proxy error:", err.message);
    res.status(500).end();
  }
});

module.exports = router;
