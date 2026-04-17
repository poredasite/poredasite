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
    const doc = await getOrCreateAds();
    const slots = ["topBanner", "sidebar", "inFeed", "stickyBanner", "popunder", "instreamVideo", "instantMessage", "belowDescription"];
    slots.forEach(key => {
      if (req.body[key] !== undefined) doc.ads[key] = req.body[key];
    });
    doc.markModified("ads");
    await doc.save();
    res.json({ success: true, data: doc.ads });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;