const mongoose = require("mongoose");

const deviceSlotSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  code:    { type: String,  default: "" },
  width:   { type: String,  default: "" },
  height:  { type: String,  default: "" },
}, { _id: false });

const adSlotSchema = new mongoose.Schema({
  desktop: { type: deviceSlotSchema, default: () => ({}) },
  mobile:  { type: deviceSlotSchema, default: () => ({}) },
}, { _id: false });

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  ads: {
    topBanner:      { type: adSlotSchema, default: () => ({}) },
    sidebar:        { type: adSlotSchema, default: () => ({}) },
    inFeed:         { type: adSlotSchema, default: () => ({}) },
    stickyBanner:   { type: adSlotSchema, default: () => ({}) },
    popunder:       { type: adSlotSchema, default: () => ({}) },
    instreamVideo:  { type: adSlotSchema, default: () => ({}) },
    instantMessage: { type: adSlotSchema, default: () => ({}) },
  },
}, { timestamps: true });

module.exports = mongoose.model("Settings", settingsSchema);
