const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const os = require("os");
const multer = require("multer");
const crypto = require("crypto");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET, CDN_URL } = require("../config/storage");
const Settings = require("../models/Settings");
const { adminAuth } = require("../middleware/auth");

const bannerUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, os.tmpdir()),
    filename: (_, file, cb) => cb(null, `banner-${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
}).single("file");

const ADS_KEY = "ads_config";

async function getOrCreateAds() {
  let doc = await Settings.findOne({ key: ADS_KEY });
  if (!doc) {
    doc = await Settings.create({ key: ADS_KEY });
  }
  return doc;
}

// GET /settings/ads — public (frontend needs this to render ads)
router.get("/ads", async (req, res) => {
  try {
    const doc = await getOrCreateAds();
    res.json({ success: true, data: doc.ads });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH /settings/ads — admin only
router.patch("/ads", adminAuth, async (req, res) => {
  try {
    const doc = await getOrCreateAds();
    const slots = ["topBanner", "sidebar", "inFeed", "stickyBanner", "popunder", "instreamVideo", "instantMessage", "belowDescription"];
    slots.forEach(key => {
      if (req.body[key] !== undefined) doc.ads[key] = req.body[key];
    });
    doc.markModified("ads");
    await doc.save();
    res.json({ success: true, data: doc.ads });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /settings/banner-upload — admin only, resim/gif → R2
router.post("/banner-upload", adminAuth, (req, res) => {
  bannerUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: "Dosya bulunamadı" });
    try {
      const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
      const key = `banners/${crypto.randomUUID()}${ext}`;
      const mimeMap = { ".gif": "image/gif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
      const contentType = mimeMap[ext] || "image/jpeg";

      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: fs.createReadStream(req.file.path),
        ContentType: contentType,
      }));

      fs.unlinkSync(req.file.path);
      res.json({ success: true, url: `${CDN_URL}/${key}` });
    } catch (e) {
      try { fs.unlinkSync(req.file.path); } catch {}
      res.status(500).json({ success: false, message: e.message });
    }
  });
});

module.exports = router;