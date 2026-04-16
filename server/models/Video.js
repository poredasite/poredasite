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
      required: [true, "Video URL is required"],
    },
    videoPublicId: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
      required: [true, "Thumbnail URL is required"],
    },
    thumbnailPublicId: {
      type: String,
      required: true,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: Number, // in seconds
      default: 0,
    },
    tags: [{ type: String, trim: true }],
    category: {
      type: require("mongoose").Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    slug: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate slug from title
videoSchema.pre("save", function (next) {
  if (this.isModified("title") || this.isNew) {
    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim() +
      "-" +
      Date.now();
  }
  next();
});

// Index for search performance
videoSchema.index({ title: "text", description: "text" });
videoSchema.index({ createdAt: -1 });
videoSchema.index({ views: -1 });

module.exports = mongoose.model("Video", videoSchema);
