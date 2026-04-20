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
  getVideoDuration, convertToHLS, uploadHLSToStorage,
  uploadThumbnailToStorage, deleteFromStorage,
  createRawUploadUrl,
} = require("../utils/hls");
const { CDN_URL }  = require("../config/storage");
const sitemap      = require("../services/sitemapService");
const { videoQueue } = require("../queue/index");

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

// Deterministic fake view count based on video ObjectId (consistent per video)
function getDisplayViews(videoId) {
  const hex = videoId.toString().slice(-6);
  const seed = parseInt(hex, 16) / 16777215; // 0.0–1.0
  if (seed < 0.05)  return Math.floor((seed / 0.05) * 99000) + 1000;
  if (seed < 0.85)  return Math.floor(((seed - 0.05) / 0.80) * 899000) + 100000;
  return Math.floor(((seed - 0.85) / 0.15) * 1000000) + 1000000;
}

function addDisplayViews(v) {
  const obj = v.toObject ? v.toObject() : { ...v };
  obj.displayViews = getDisplayViews(obj._id);
  return obj;
}

// ── Related-video scoring (tag overlap + category + popularity) ───────────────
// Fetches up to 80 candidates sharing tags/category, scores in-memory, fills
// remainder with trending. Safe for 10k+ collections because MongoDB filters
// before Node processes.
async function getRelatedVideos(video, limit = 12) {
  const tags   = video.tags || [];
  const catIds = [
    ...(Array.isArray(video.categories) ? video.categories.map((c) => c._id ?? c) : []),
    video.category ? (video.category._id ?? video.category) : null,
  ].filter(Boolean);

  const orClauses = [];
  if (tags.length)   orClauses.push({ tags: { $in: tags } });
  if (catIds.length) orClauses.push({ category: { $in: catIds } }, { categories: { $in: catIds } });

  const baseSelect = "_id title thumbnailUrl views createdAt duration tags category categories slug previewVideoUrl";

  const [candidates, trending] = await Promise.all([
    orClauses.length
      ? Video.find({ _id: { $ne: video._id }, status: "ready", $or: orClauses })
          .limit(80).select(baseSelect + " avgWatchTime completionRate")
          .populate("category", "name slug")
          .populate("categories", "name slug")
          .lean()
      : Promise.resolve([]),
    Video.find({ _id: { $ne: video._id }, status: "ready" })
      .sort({ views: -1 }).limit(20)
      .select(baseSelect + " avgWatchTime completionRate")
      .lean(),
  ]);

  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  const catSet = new Set(catIds.map(String));

  const scoreVideo = (v) => {
    let s = 0;
    s += (v.tags || []).filter((t) => tagSet.has(t.toLowerCase())).length * 3;
    const vc = [
      ...(v.categories || []).map((c) => String(c._id || c)),
      v.category ? String(v.category._id || v.category) : "",
    ].filter(Boolean);
    if (vc.some((c) => catSet.has(c))) s += 2;
    s += Math.min(2, Math.log10((v.views || 0) + 1) / 3);
    // Watch time signals: clickbait drops here, genuinely watched content rises
    s += Math.min(3, ((v.avgWatchTime || 0) / 1800) * 3);  // up to 3pts for 30min avg
    s += (v.completionRate || 0) * 2;                       // up to 2pts for 100% completion
    return s;
  };

  // Deduplicate; candidates take priority (already scored), trending fills gaps
  const pool = new Map();
  for (const v of candidates) pool.set(String(v._id), { ...v, _s: scoreVideo(v) });
  for (const v of trending)   if (!pool.has(String(v._id))) pool.set(String(v._id), { ...v, _s: scoreVideo(v) });

  return [...pool.values()]
    .sort((a, b) => b._s - a._s)
    .slice(0, limit)
    .map(({ _s, ...v }) => v);
}

// GET /videos
router.get("/", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip  = (page - 1) * limit;
    const sortParam = req.query.sort; // "views" | "new" | "algo" | undefined
    const filter = { status: { $in: ["ready", "uploaded"] } };
    if (req.query.category) {
      const catId = mongoose.Types.ObjectId.isValid(req.query.category)
        ? new mongoose.Types.ObjectId(req.query.category)
        : req.query.category;
      filter.$or = [{ category: catId }, { categories: catId }];
    }

    // Algorithm sort: weighted score using views, likes, comments, recency, completion
    if (!sortParam || sortParam === "algo") {
      const dayMs  = 86400000;
      const [docs, total] = await Promise.all([
        Video.aggregate([
          { $match: filter },
          { $addFields: { _score: { $add: [
            { $multiply: [{ $ln: { $add: [{ $ifNull: ["$views", 0] }, 1] } }, 1] },
            { $multiply: [{ $ifNull: ["$likes", 0] }, 3] },
            { $multiply: [{ $ifNull: ["$commentCount", 0] }, 2] },
            { $max: [0, { $subtract: [7, { $divide: [{ $subtract: ["$$NOW", "$createdAt"] }, dayMs] }] }] },
            { $multiply: [{ $ifNull: ["$completionRate", 0] }, 5] },
          ]}}},
          { $sort: { _score: -1 } },
          { $skip: skip }, { $limit: limit },
          { $lookup: { from: "categories", localField: "category",   foreignField: "_id", as: "_c" } },
          { $lookup: { from: "categories", localField: "categories", foreignField: "_id", as: "categories" } },
          { $addFields: { category: { $first: "$_c" } } },
          { $project: { _c: 0, _score: 0, videoPublicId: 0, thumbnailPublicId: 0 } },
        ]),
        Video.countDocuments(filter),
      ]);
      return res.json({ success: true, data: docs.map(addDisplayViews), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }

    const sort = sortParam === "views" ? { views: -1 } : { createdAt: -1 };
    const [videos, total] = await Promise.all([
      Video.find(filter).sort(sort).skip(skip).limit(limit)
        .select("-videoPublicId -thumbnailPublicId")
        .populate("category", "name icon color slug")
        .populate("categories", "name icon color slug"),
      Video.countDocuments(filter),
    ]);
    res.json({ success: true, data: videos.map(addDisplayViews), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /videos/search?q=...
router.get("/search", async (req, res) => {
  try {
    const q     = (req.query.q || "").trim();
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(48, parseInt(req.query.limit) || 24);
    const skip  = (page - 1) * limit;

    if (!q) return res.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 0 } });

    const filter = { status: { $in: ["ready", "uploaded"] }, $text: { $search: q } };

    const [videos, total] = await Promise.all([
      Video.find(filter, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .skip(skip).limit(limit)
        .select("-videoPublicId -thumbnailPublicId")
        .populate("category",   "name icon color slug")
        .populate("categories", "name icon color slug")
        .lean(),
      Video.countDocuments(filter),
    ]);

    res.json({ success: true, data: videos.map(addDisplayViews), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /videos/sitemap
router.get("/sitemap", async (req, res) => {
  try {
    const videos = await Video.find({ status: { $in: ["ready", "uploaded"] } }).select("_id slug title createdAt updatedAt").sort({ createdAt: -1 });
    res.json({ success: true, data: videos });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /videos/sidebar  — trending + recent for sidebar widgets
router.get("/sidebar", async (req, res) => {
  try {
    const [trending, recent] = await Promise.all([
      Video.find({ status: { $in: ["ready", "uploaded"] } }).sort({ views: -1 }).limit(8)
        .select("_id title thumbnailUrl views duration createdAt slug").lean(),
      Video.find({ status: { $in: ["ready", "uploaded"] } }).sort({ createdAt: -1 }).limit(8)
        .select("_id title thumbnailUrl views duration createdAt slug").lean(),
    ]);
    res.json({ success: true, data: { trending: trending.map(addDisplayViews), recent: recent.map(addDisplayViews) } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /videos/tag/:tag/meta  — related tags + categories for a tag (SEO landing page)
router.get("/tag/:tag/meta", async (req, res) => {
  try {
    const tag = decodeURIComponent(req.params.tag).replace(/-/g, " ");
    const sample = await Video.find({ status: "ready", tags: { $regex: new RegExp(`^${tag}$`, "i") } })
      .limit(120).select("tags category categories").lean();

    // Count co-occurring tags
    const tagCount = {};
    const catMap   = {};
    for (const v of sample) {
      for (const t of (v.tags || [])) {
        if (t.toLowerCase() !== tag.toLowerCase()) tagCount[t] = (tagCount[t] || 0) + 1;
      }
      const cats = [
        ...(v.categories || []),
        ...(v.category ? [v.category] : []),
      ];
      for (const c of cats) if (c) catMap[String(c._id || c)] = c;
    }

    const relatedTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([t]) => t);

    // Fetch populated categories
    const catIds = Object.keys(catMap);
    const Category = require("../models/Category");
    const categories = catIds.length
      ? await Category.find({ _id: { $in: catIds } }).select("name slug icon").lean()
      : [];

    res.json({ success: true, data: { relatedTags, categories } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /videos/tag/:tag  — all videos with a specific tag, paginated
router.get("/tag/:tag", async (req, res) => {
  try {
    // Accept both hyphen-slug and space-encoded URLs → normalise to stored tag value
    const tag   = decodeURIComponent(req.params.tag).replace(/-/g, " ");
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(48, parseInt(req.query.limit) || 24);
    const skip  = (page - 1) * limit;
    const filter = { status: "ready", tags: { $regex: new RegExp(`^${tag}$`, "i") } };
    if (req.query.category) filter.categories = req.query.category;
    const [videos, total] = await Promise.all([
      Video.find(filter).sort({ views: -1 }).skip(skip).limit(limit)
        .select("-videoPublicId -thumbnailPublicId")
        .populate("category",   "name icon color slug")
        .populate("categories", "name icon color slug")
        .lean(),
      Video.countDocuments(filter),
    ]);
    res.json({ success: true, data: videos.map(addDisplayViews), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /videos/:id  — accepts both MongoDB ObjectId and URL slug
router.get("/:id", async (req, res) => {
  try {
    const identifier = req.params.id;
    const isObjectId = /^[a-f\d]{24}$/i.test(identifier);
    const query = isObjectId ? Video.findByIdAndUpdate(identifier, { $inc: { views: 1 } }, { new: true })
      : Video.findOneAndUpdate({ slug: identifier }, { $inc: { views: 1 } }, { new: true });
    const video = await query
      .select("-videoPublicId -thumbnailPublicId")
      .populate("category", "name icon color slug")
      .populate("categories", "name icon color slug");
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    const related = await getRelatedVideos(video, 12);
    const videoData = video.toObject();
    // Unified playback fields consumed by the frontend player
    videoData.hlsUrl = video.videoUrl;
    videoData.previewUrl = video.previewVideoUrl || null;
    videoData.previewStartTime = video.duration ? Math.floor(video.duration * 0.15) : 0;
    videoData.previewEndTime = video.duration ? Math.floor(video.duration * 0.85) : 0;
    videoData.displayViews = getDisplayViews(videoData._id);
    res.json({ success: true, data: videoData, related: related.map(addDisplayViews) });
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

      const thumbFile = req.file;
      const videoId = new mongoose.Types.ObjectId();
      const categoriesArr = categoriesRaw ? JSON.parse(categoriesRaw) : (category ? [category] : []);

      let thumbnailUrl = "";
      let thumbnailKey = "";
      if (thumbFile) {
        const result = await uploadThumbnailToStorage(thumbFile.path, videoId.toString(), thumbFile.mimetype);
        thumbnailUrl = result.url;
        thumbnailKey = result.key;
        fs.unlinkSync(thumbFile.path);
      }

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

// POST /videos/:id/process  — enqueue BullMQ job; returns immediately
router.post("/:id/process", adminAuth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video)             return res.status(404).json({ success: false, message: "Video not found" });
    if (!video.rawVideoKey) return res.status(400).json({ success: false, message: "No raw video to process" });

    const job = await videoQueue.add(
      "encode",
      { videoId: video._id.toString(), rawKey: video.rawVideoKey },
      { priority: req.body.priority === "high" ? 1 : 10 }
    );

    res.json({ success: true, message: "Queued for processing", jobId: job.id });
  } catch (err) {
    console.error("Enqueue error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /videos/:id/job-status  — poll job progress from client
router.get("/:id/job-status", adminAuth, async (req, res) => {
  try {
    const waiting  = await videoQueue.getWaiting();
    const active   = await videoQueue.getActive();
    const failed   = await videoQueue.getFailed();

    const id = req.params.id;
    const find = (jobs) => jobs.find((j) => j.data.videoId === id);
    const job  = find(active) || find(waiting) || find(failed);

    if (!job) {
      const video = await Video.findById(id).select("status").lean();
      return res.json({ success: true, status: video?.status || "unknown", progress: video?.status === "ready" ? 100 : 0 });
    }

    const state    = await job.getState();
    const progress = job.progress || 0;
    res.json({ success: true, status: state, progress, jobId: job.id, attempts: job.attemptsMade });
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

// POST /videos/:id/like  — toggle like (client tracks state via localStorage)
router.post("/:id/like", async (req, res) => {
  try {
    const { liked } = req.body; // true = add like, false = remove like
    const inc = liked === true ? 1 : -1;
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: inc } },
      { new: true }
    ).select("likes");
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    // Prevent negative likes
    if (video.likes < 0) await Video.findByIdAndUpdate(req.params.id, { likes: 0 });
    res.json({ success: true, likes: Math.max(0, video.likes) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /videos/:id/watch  — record watch session, update running averages
// Uses Welford's online algorithm so we never need to store individual events.
router.post("/:id/watch", async (req, res) => {
  try {
    const { watchTime, duration } = req.body;
    const wt = Math.min(Number(watchTime) || 0, 14400); // cap at 4h (data sanity)
    const dur = Math.max(1, Number(duration) || 1);
    if (wt < 3) return res.json({ success: true });      // ignore bounces

    const rate = Math.min(1, wt / dur);

    // Atomic running-average update — no read-modify-write race
    await Video.findByIdAndUpdate(req.params.id, [
      {
        $set: {
          watchSessions:  { $add: ["$watchSessions", 1] },
          avgWatchTime:   {
            $divide: [
              { $add: [{ $multiply: ["$avgWatchTime", "$watchSessions"] }, wt] },
              { $add: ["$watchSessions", 1] },
            ],
          },
          completionRate: {
            $divide: [
              { $add: [{ $multiply: ["$completionRate", "$watchSessions"] }, rate] },
              { $add: ["$watchSessions", 1] },
            ],
          },
        },
      },
    ]);

    res.json({ success: true });
  } catch (err) {
    if (err.name === "CastError") return res.json({ success: true }); // ignore bad ids
    res.status(500).json({ success: false });
  }
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
