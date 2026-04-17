const express = require("express");
const router = express.Router();
const multer = require("multer");
const os = require("os");
const fs = require("fs");
const mongoose = require("mongoose");
const Video = require("../models/Video");
const { adminAuth } = require("../middleware/auth");
const { getVideoDuration, convertToHLS, uploadHLSToWasabi, uploadThumbnailToWasabi, deleteFromWasabi } = require("../utils/hls");

const diskUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, os.tmpdir()),
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
}).fields([{ name: "video", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]);

// GET /videos
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;
    const sort = req.query.sort === "views" ? { views: -1 } : { createdAt: -1 };
    const filter = { status: "ready" };
    if (req.query.category) filter.category = req.query.category;

    const [videos, total] = await Promise.all([
      Video.find(filter).sort(sort).skip(skip).limit(limit)
        .select("-videoPublicId -thumbnailPublicId")
        .populate("category", "name icon color slug"),
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
      .populate("category", "name icon color slug");
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    const related = await Video.find({ _id: { $ne: video._id }, status: "ready" })
      .sort({ views: -1 }).limit(8)
      .select("_id title thumbnailUrl views createdAt duration");
    res.json({ success: true, data: video, related });
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ success: false, message: "Video not found" });
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
      const { url: thumbnailUrl, key: thumbnailKey } = await uploadThumbnailToWasabi(
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
          const hlsUrl = await uploadHLSToWasabi(outputDir, videoId.toString());
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
      deleteFromWasabi(`videos/${video._id}/`),
      deleteFromWasabi(video.thumbnailPublicId),
    ]);
    await video.deleteOne();
    res.json({ success: true, message: "Video deleted successfully" });
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ success: false, message: "Video not found" });
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH /videos/:id
router.patch("/:id", adminAuth, async (req, res) => {
  try {
    const { title, description, tags, category } = req.body;
    const update = {};
    if (title) update.title = title.trim();
    if (description !== undefined) update.description = description.trim();
    if (tags !== undefined) update.tags = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (category !== undefined) update.category = category || null;
    const video = await Video.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .select("-videoPublicId -thumbnailPublicId")
      .populate("category", "name icon color slug");
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    res.json({ success: true, data: video });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
