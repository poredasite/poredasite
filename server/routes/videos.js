const express = require("express");
const router = express.Router();


const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs");
const mongoose = require("mongoose");
const Video = require("../models/Video");
const { adminAuth } = require("../middleware/auth");
const {
  getVideoDuration, extractCodecInfo, convertToHLS,
  uploadHLSToStorage, uploadThumbnailToStorage,
  deleteFromStorage, createRawUploadUrl,
  downloadRawFromStorage, deleteRawFromStorage,
  generatePreviewClip, uploadPreviewToStorage,
  generateMp4Fallback, uploadMp4FallbackToStorage,
} = require("../utils/hls");
const { CDN_URL } = require("../config/storage");

const diskUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, os.tmpdir()),
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
}).fields([{ name: "video", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]);

const thumbOnlyUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, os.tmpdir()),
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
}).single("thumbnail");

// GET /videos
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;
    const sort = req.query.sort === "views" ? { views: -1 } : { createdAt: -1 };
    const filter = { status: "ready" };
    if (req.query.category) filter.$or = [{ category: req.query.category }, { categories: req.query.category }];

    const [videos, total] = await Promise.all([
      Video.find(filter).sort(sort).skip(skip).limit(limit)
        .select("-videoPublicId -thumbnailPublicId")
        .populate("category", "name icon color slug")
        .populate("categories", "name icon color slug"),
      Video.countDocuments(filter),
    ]);
    res.json({ success: true, data: videos, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /videos/sitemap
router.get("/sitemap", async (req, res) => {
  try {
    const videos = await Video.find({ status: "ready" }).select("_id slug title createdAt updatedAt").sort({ createdAt: -1 });
    res.json({ success: true, data: videos });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /videos/:id
router.get("/:id", async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true })
      .select("-videoPublicId -thumbnailPublicId")
      .populate("category", "name icon color slug")
      .populate("categories", "name icon color slug");
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    const related = await Video.find({ _id: { $ne: video._id }, status: "ready" })
      .sort({ views: -1 }).limit(8)
      .select("_id title thumbnailUrl views createdAt duration");
    const videoData = video.toObject();
    // Unified playback fields consumed by the frontend player
    videoData.hlsUrl = video.videoUrl;
    videoData.previewUrl = video.previewVideoUrl || null;
    videoData.previewStartTime = video.duration ? Math.floor(video.duration * 0.15) : 0;
    videoData.previewEndTime = video.duration ? Math.floor(video.duration * 0.85) : 0;
    res.json({ success: true, data: videoData, related });
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ success: false, message: "Video not found" });
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /videos/upload-init  — step 1: thumbnail + metadata → presigned URL for direct video upload
router.post("/upload-init", adminAuth, (req, res) => {
  thumbOnlyUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    try {
      const { title, description, tags, category, categories: categoriesRaw, videoType } = req.body;
      if (!title?.trim()) return res.status(400).json({ success: false, message: "Title is required" });
      if (!req.file) return res.status(400).json({ success: false, message: "Thumbnail is required" });

      const thumbFile = req.file;
      const videoId = new mongoose.Types.ObjectId();
      const categoriesArr = categoriesRaw ? JSON.parse(categoriesRaw) : (category ? [category] : []);

      const { url: thumbnailUrl, key: thumbnailKey } = await uploadThumbnailToStorage(
        thumbFile.path, videoId.toString(), thumbFile.mimetype
      );
      fs.unlinkSync(thumbFile.path);

      const { url: uploadUrl, key: rawKey } = await createRawUploadUrl(
        videoId.toString(), videoType || "video/mp4"
      );

      const video = await Video.create({
        _id: videoId,
        title: title.trim(),
        description: description?.trim() || "",
        videoUrl: "",
        videoPublicId: `videos/${videoId}`,
        thumbnailUrl,
        thumbnailPublicId: thumbnailKey,
        duration: 0,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        category: categoriesArr[0] || null,
        categories: categoriesArr,
        status: "processing",
        rawVideoKey: rawKey,
      });

      res.status(201).json({ success: true, data: { videoId: video._id, uploadUrl, video } });
    } catch (err) {
      console.error("Upload init error:", err);
      res.status(500).json({ success: false, message: "Init failed: " + err.message });
    }
  });
});

// POST /videos/:id/process  — trigger FFmpeg HLS encode in background
router.post("/:id/process", adminAuth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    if (!video.rawVideoKey) return res.status(400).json({ success: false, message: "No raw video to process" });

    res.json({ success: true, message: "Processing started" });

    // ── Background HLS encode ─────────────────────────────────────────
    (async () => {
      const ext = path.extname(video.rawVideoKey) || ".mp4";
      const tmpPath = path.join(os.tmpdir(), `raw-${video._id}${ext}`);
      try {
        await downloadRawFromStorage(video.rawVideoKey, tmpPath);
        const duration = await getVideoDuration(tmpPath);
        const id = video._id.toString();

        // Sequential encoding to avoid OOM (SIGKILL) on Railway
        const codecInfo = await extractCodecInfo(tmpPath);
        const outputDir = await convertToHLS(tmpPath, id);
        const hlsUrl = await uploadHLSToStorage(outputDir, id);

        const previewPath = await generatePreviewClip(tmpPath, id, duration)
          .catch((e) => { console.error("❌ Preview generate failed:", e.message); return null; });
        const previewUrl = previewPath
          ? await uploadPreviewToStorage(previewPath, id).catch((e) => { console.error("❌ Preview upload failed:", e.message); return null; })
          : null;

        const mp4FallbackPath = await generateMp4Fallback(tmpPath, id)
          .catch((e) => { console.error("❌ MP4 fallback failed:", e.message); return null; });
        const mp4FallbackUrl = mp4FallbackPath
          ? await uploadMp4FallbackToStorage(mp4FallbackPath, id).catch(() => null)
          : null;

        fs.unlinkSync(tmpPath);

        await deleteRawFromStorage(video.rawVideoKey);
        await Video.findByIdAndUpdate(video._id, {
          videoUrl: hlsUrl,
          duration,
          rawVideoKey: null,
          status: "ready",
          codecInfo,
          ...(previewUrl ? { previewVideoUrl: previewUrl } : {}),
          ...(mp4FallbackUrl ? { mp4FallbackUrl } : {}),
        });
        console.log(`✅ HLS ready: ${hlsUrl}${previewUrl ? " | preview: " + previewUrl : ""}${mp4FallbackUrl ? " | fallback: " + mp4FallbackUrl : ""}`);
      } catch (bgErr) {
        console.error("HLS encode error:", bgErr);
        try { fs.unlinkSync(tmpPath); } catch {}
        await Video.findByIdAndUpdate(video._id, { status: "error" });
      }
    })();
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /videos/upload
router.post("/upload", adminAuth, (req, res) => {
  diskUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    try {
      const { title, description, tags, category } = req.body;
      if (!title?.trim()) return res.status(400).json({ success: false, message: "Title is required" });
      if (!req.files?.video?.[0]) return res.status(400).json({ success: false, message: "Video file is required" });
      if (!req.files?.thumbnail?.[0]) return res.status(400).json({ success: false, message: "Thumbnail is required" });

      const videoFile = req.files.video[0];
      const thumbFile = req.files.thumbnail[0];
      const videoId = new mongoose.Types.ObjectId();

      // Upload thumbnail immediately
      const { url: thumbnailUrl, key: thumbnailKey } = await uploadThumbnailToStorage(
        thumbFile.path, videoId.toString(), thumbFile.mimetype
      );
      fs.unlinkSync(thumbFile.path);

      // Create DB record with processing status
      const video = await Video.create({
        _id: videoId,
        title: title.trim(),
        description: description?.trim() || "",
        videoUrl: "",
        videoPublicId: `videos/${videoId}`,
        thumbnailUrl,
        thumbnailPublicId: thumbnailKey,
        duration: 0,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        category: category || null,
        status: "processing",
      });

      // Respond immediately
      res.status(201).json({ success: true, message: "Upload received, processing...", data: video });

      // Background: FFmpeg → HLS → Wasabi
      (async () => {
        try {
          const duration = await getVideoDuration(videoFile.path);
          const outputDir = await convertToHLS(videoFile.path, videoId.toString());
          fs.unlinkSync(videoFile.path);
          const hlsUrl = await uploadHLSToStorage(outputDir, videoId.toString());
          await Video.findByIdAndUpdate(videoId, { videoUrl: hlsUrl, duration, status: "ready" });
          console.log(`✅ HLS ready: ${hlsUrl}`);
        } catch (bgErr) {
          console.error("HLS processing error:", bgErr);
          try { fs.unlinkSync(videoFile.path); } catch {}
          await Video.findByIdAndUpdate(videoId, { status: "error" });
        }
      })();
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ success: false, message: "Upload failed: " + err.message });
    }
  });
});

// DELETE /videos/:id
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    await Promise.allSettled([
      deleteFromStorage(`videos/${video._id}/`),
      video.thumbnailPublicId ? deleteFromStorage(video.thumbnailPublicId) : Promise.resolve(),
      deleteFromStorage(`previews/${video._id}.mp4`),
      deleteFromStorage(`fallback/${video._id}.mp4`),
    ]);
    await video.deleteOne();
    res.json({ success: true, message: "Video deleted successfully" });
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ success: false, message: "Video not found" });
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH /videos/:id
router.patch("/:id", adminAuth, (req, res, next) => {
  thumbOnlyUpload(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const { title, description, tags, category, categories: categoriesRaw } = req.body;
    const update = {};
    if (title) update.title = title.trim();
    if (description !== undefined) update.description = description.trim();
    if (tags !== undefined) update.tags = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (categoriesRaw !== undefined) {
      const arr = typeof categoriesRaw === "string" ? JSON.parse(categoriesRaw) : categoriesRaw || [];
      update.categories = arr;
      update.category = arr[0] || null;
    } else if (category !== undefined) {
      update.category = category || null;
    }
    if (req.file) {
      const existing = await Video.findById(req.params.id).select("thumbnailPublicId");
      if (existing?.thumbnailPublicId) {
        try { await deleteFromStorage(existing.thumbnailPublicId); } catch {}
      }
      const { url: thumbnailUrl, key: thumbnailKey } = await uploadThumbnailToStorage(req.file.path, req.params.id, req.file.mimetype);
      fs.unlinkSync(req.file.path);
      update.thumbnailUrl = thumbnailUrl;
      update.thumbnailPublicId = thumbnailKey;
    }
    const video = await Video.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .select("-videoPublicId -thumbnailPublicId")
      .populate("category", "name icon color slug")
      .populate("categories", "name icon color slug");
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    res.json({ success: true, data: video });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
