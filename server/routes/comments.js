const express  = require("express");
const router   = express.Router();
const Comment  = require("../models/Comment");
const Video    = require("../models/Video");
const rateLimit = require("express-rate-limit");

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, message: "Çok fazla yorum — 1 dakika bekle" },
});

// GET /comments/:videoId
router.get("/:videoId", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      Comment.find({ videoId: req.params.videoId })
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit).lean(),
      Comment.countDocuments({ videoId: req.params.videoId }),
    ]);

    res.json({ success: true, data: comments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /comments/:videoId
router.post("/:videoId", commentLimiter, async (req, res) => {
  try {
    const { username, text } = req.body;
    if (!username?.trim()) return res.status(400).json({ success: false, message: "Kullanıcı adı zorunlu" });
    if (!text?.trim())     return res.status(400).json({ success: false, message: "Yorum metni zorunlu" });

    const comment = await Comment.create({
      videoId:  req.params.videoId,
      username: username.trim().slice(0, 30),
      text:     text.trim().slice(0, 500),
    });

    // Denormalized count update
    await Video.findByIdAndUpdate(req.params.videoId, { $inc: { commentCount: 1 } });

    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
