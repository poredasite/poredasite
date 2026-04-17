const express = require("express");
const router = express.Router();
const { cloudinary } = require("../config/cloudinary");
const Video = require("../models/Video");
const { adminAuth } = require("../middleware/auth");

// GET /videos
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;
    const sort = req.query.sort === "views" ? { views: -1 } : { createdAt: -1 };
    const filter = {};
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
    const videos = await Video.find().select("_id slug title createdAt updatedAt").sort({ createdAt: -1 });
    res.json({ success: true, data: videos });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /videos/:id - increment views
router.get("/:id", async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true })
      .select("-videoPublicId -thumbnailPublicId")
      .populate("category", "name icon color slug");
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    const related = await Video.find({ _id: { $ne: video._id } }).sort({ views: -1 }).limit(8).select("_id title thumbnailUrl views createdAt duration");
    res.json({ success: true, data: video, related });
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ success: false, message: "Video not found" });
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /videos/sign-upload — Cloudinary imzası üret
router.get("/sign-upload", adminAuth, (req, res) => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = req.query.folder || "poreda/videos";
  const paramsToSign = { folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
  res.json({
    success: true,
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
  });
});

// POST /videos/upload — Cloudinary URL'lerini DB'ye kaydet
router.post("/upload", adminAuth, async (req, res) => {
  try {
    const { title, description, tags, category, videoUrl, videoPublicId, thumbnailUrl, thumbnailPublicId, duration } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: "Title is required" });
    if (!videoUrl) return res.status(400).json({ success: false, message: "Video URL is required" });
    if (!thumbnailUrl) return res.status(400).json({ success: false, message: "Thumbnail URL is required" });

    const video = await Video.create({
      title: title.trim(),
      description: description?.trim() || "",
      videoUrl,
      videoPublicId: videoPublicId || "",
      thumbnailUrl,
      thumbnailPublicId: thumbnailPublicId || "",
      duration: duration || 0,
      tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      category: category || null,
    });

    res.status(201).json({ success: true, message: "Video uploaded successfully", data: video });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, message: "Upload failed: " + err.message });
  }
});

// DELETE /videos/:id
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    await Promise.allSettled([
      cloudinary.uploader.destroy(video.videoPublicId, { resource_type: "video" }),
      cloudinary.uploader.destroy(video.thumbnailPublicId, { resource_type: "image" }),
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
    if (tags !== undefined) update.tags = tags.split(",").map(t => t.trim()).filter(Boolean);
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
