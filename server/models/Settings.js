const mongoose = require("mongoose");

const adSlotSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  code: { type: String, default: "" },
}, { _id: false });

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  ads: {
    topBanner: { type: adSlotSchema, default: () => ({}) },
    sidebar:   { type: adSlotSchema, default: () => ({}) },
    inFeed:    { type: adSlotSchema, default: () => ({}) },
  },
}, { timestamps: true });

module.exports = mongoose.model("Settings", settingsSchema);