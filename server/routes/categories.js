const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const Video = require("../models/Video");
const { adminAuth } = require("../middleware/auth");

// GET /categories — list all with video counts (single aggregation, no N+1)
router.get("/", async (req, res) => {
  try {
    const [categories, countAgg] = await Promise.all([
      Category.find().sort({ name: 1 }),
      Video.aggregate([
        { $match: { status: "ready" } },
        {
          $project: {
            allCats: {
              $setUnion: [
                { $ifNull: ["$categories", []] },
                { $cond: { if: "$category", then: ["$category"], else: [] } },
              ],
            },
          },
        },
        { $unwind: "$allCats" },
        { $group: { _id: "$allCats", count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = Object.fromEntries(
      countAgg.map((c) => [c._id.toString(), c.count])
    );

    const data = categories.map((cat) => ({
      ...cat.toObject(),
      videoCount: countMap[cat._id.toString()] || 0,
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /categories — create (admin)
router.post("/", adminAuth, async (req, res) => {
  try {
    const { name, icon, description, color, section } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const category = await Category.create({
      name: name.trim(),
      icon: icon || "🎬",
      description: description?.trim() || "",
      color: color || "#ff6b00",
      section: section || null,
    });

    res.status(201).json({ success: true, data: category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Category already exists" });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH /categories/:id — update (admin)
router.patch("/:id", adminAuth, async (req, res) => {
  try {
    const { name, icon, description, color, section } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (icon) update.icon = icon;
    if (description !== undefined) update.description = description.trim();
    if (color) update.color = color;
    if ("section" in req.body) update.section = section || null;

    const category = await Category.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, data: category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Category name already exists" });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /categories/:id — delete (admin)
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    await Video.updateMany(
      { $or: [{ category: category._id }, { categories: category._id }] },
      { $unset: { category: 1 }, $pull: { categories: category._id } }
    );
    await category.deleteOne();

    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
