const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, "Description cannot exceed 5000 characters"],
      default: "",
    },
    videoUrl: {
      type: String,
      default: "",
    },
    videoPublicId: {
      type: String,
      default: "",
    },
    thumbnailUrl: {
      type: String,
      default: "",
    },
    thumbnailPublicId: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["processing", "uploaded", "ready", "error"],
      default: "processing",
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: Number,
      default: 0,
    },
    likes:          { type: Number, default: 0, min: 0 },
    commentCount:   { type: Number, default: 0, min: 0 },
    watchSessions:  { type: Number, default: 0, min: 0 },
    avgWatchTime:   { type: Number, default: 0, min: 0 },
    completionRate: { type: Number, default: 0, min: 0, max: 1 },
    tags: [{ type: String, trim: true }],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    }],
    slug: {
      type: String,
      unique: true,
    },
    rawVideoKey: {
      type: String,
      default: null,
    },
    previewVideoUrl: {
      type: String,
      default: "",
    },
    mp4FallbackUrl: {
      type: String,
      default: "",
    },
    codecInfo: {
      videoCodec: { type: String, default: "" },
      audioCodec: { type: String, default: "" },
      profile: { type: String, default: "" },
      level: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

videoSchema.pre("save", function (next) {
  if (this.isModified("title") || this.isNew) {
    const base = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    // Use last 8 chars of ObjectId as unique suffix (shorter than timestamp)
    const suffix = this._id.toString().slice(-8);
    this.slug = `${base}-${suffix}`;
  }
  next();
});

videoSchema.index({ title: "text", description: "text" });
videoSchema.index({ createdAt: -1 });
videoSchema.index({ views: -1 });
videoSchema.index({ status: 1 });
videoSchema.index({ tags: 1 });

module.exports = mongoose.model("Video", videoSchema);
