const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  videoId:  { type: mongoose.Schema.Types.ObjectId, ref: "Video", required: true, index: true },
  username: { type: String, required: true, trim: true, maxlength: 30 },
  text:     { type: String, required: true, trim: true, maxlength: 500 },
}, { timestamps: true });

commentSchema.index({ videoId: 1, createdAt: -1 });

module.exports = mongoose.model("Comment", commentSchema);
