const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const Video = require("../models/Video");
const { adminAuth } = require("../middleware/auth");

// GET /categories — list all with video counts
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });

    // Attach live video counts
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await Video.countDocuments({ $or: [{ category: cat._id }, { categories: cat._id }] });
        return { ...cat.toObject(), videoCount: count };
      })
    );

    res.json({ success: true, data: withCounts });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /categories — create (admin)
router.post("/", adminAuth, async (req, res) => {
  try {
    const { name, icon, description, color } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const category = await Category.create({
      name: name.trim(),
      icon: icon || "🎬",
      description: description?.trim() || "",
      color: color || "#ff6b00",
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
    const { name, icon, description, color } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (icon) update.icon = icon;
    if (description !== undefined) update.description = description.trim();
    if (color) update.color = color;

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

    // Remove category reference from videos
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
