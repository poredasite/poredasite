const express = require("express");
const router = express.Router();
const Settings = require("../models/Settings");
const { adminAuth } = require("../middleware/auth");

const ADS_KEY = "ads_config";

async function getOrCreateAds() {
  let doc = await Settings.findOne({ key: ADS_KEY });
  if (!doc) {
    doc = await Settings.create({ key: ADS_KEY });
  }
  return doc;
}

// GET /settings/ads — public (frontend needs this to render ads)
router.get("/ads", async (req, res) => {
  try {
    const doc = await getOrCreateAds();
    res.json({ success: true, data: doc.ads });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH /settings/ads — admin only
router.patch("/ads", adminAuth, async (req, res) => {
  try {
    const { topBanner, sidebar, inFeed } = req.body;
    const doc = await getOrCreateAds();

    if (topBanner !== undefined) doc.ads.topBanner = topBanner;
    if (sidebar   !== undefined) doc.ads.sidebar   = sidebar;
    if (inFeed    !== undefined) doc.ads.inFeed     = inFeed;

    await doc.save();
    res.json({ success: true, data: doc.ads });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;