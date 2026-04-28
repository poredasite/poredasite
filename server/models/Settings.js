const mongoose = require("mongoose");

const deviceSlotSchema = new mongoose.Schema({
  enabled:     { type: Boolean, default: false },
  code:        { type: String,  default: "" },
  vastUrl:     { type: String,  default: "" },
  imageUrl:    { type: String,  default: "" },
  linkUrl:     { type: String,  default: "" },
  videoUrl:    { type: String,  default: "" },
  title:       { type: String,  default: "" },
  description: { type: String,  default: "" },
  width:       { type: String,  default: "" },
  height:      { type: String,  default: "" },
}, { _id: false });

const adSlotSchema = new mongoose.Schema({
  desktop: { type: deviceSlotSchema, default: () => ({}) },
  mobile:  { type: deviceSlotSchema, default: () => ({}) },
}, { _id: false });

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  ads: {
    topBanner:        { type: adSlotSchema, default: () => ({}) },
    sidebar:          { type: adSlotSchema, default: () => ({}) },
    inFeed:           { type: adSlotSchema, default: () => ({}) },
    stickyBanner:     { type: adSlotSchema, default: () => ({}) },
    popunder:         { type: adSlotSchema, default: () => ({}) },
    instreamVideo:    { type: adSlotSchema, default: () => ({}) },
    instantMessage:   { type: adSlotSchema, default: () => ({}) },
    belowDescription: { type: adSlotSchema, default: () => ({}) },
    belowDescription2: { type: adSlotSchema, default: () => ({}) },
    belowDescription3: { type: adSlotSchema, default: () => ({}) },
    belowDescription4: { type: adSlotSchema, default: () => ({}) },
    topBanner2:        { type: adSlotSchema, default: () => ({}) },
    topBanner3:        { type: adSlotSchema, default: () => ({}) },
    topBanner4:        { type: adSlotSchema, default: () => ({}) },
    nativeFeed1:       { type: adSlotSchema, default: () => ({}) },
    nativeFeed2:       { type: adSlotSchema, default: () => ({}) },
    nativeFeed3:       { type: adSlotSchema, default: () => ({}) },
    nativeFeed4:       { type: adSlotSchema, default: () => ({}) },
  },
}, { timestamps: true });

module.exports = mongoose.model("Settings", settingsSchema);
