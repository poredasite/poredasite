require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const videosRouter = require("./routes/videos");
const categoriesRouter = require("./routes/categories");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security & Middleware ─────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
    cors({
      origin: "*",
      credentials: false,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "x-admin-password"],
    })
);

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: "Too many requests, please try again later." },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, message: "Upload limit reached, please try again later." },
});

app.use("/api", generalLimiter);
app.use("/api/videos/upload", uploadLimiter);

// ─── Routes ───────────────────────────────────────────────────────

app.use("/api/videos", videosRouter);
app.use("/api/categories", categoriesRouter);

// Admin password verify endpoint
app.post("/api/admin/verify", (req, res) => {
  const password = req.headers["x-admin-password"] || req.body.adminPassword;
  if (!password) return res.status(401).json({ success: false, message: "Password required" });
  if (password !== process.env.ADMIN_PASSWORD) return res.status(403).json({ success: false, message: "Invalid password" });
  res.json({ success: true, message: "Authenticated" });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "poreda API çalışıyor",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Dynamic sitemap.xml
app.get("/sitemap.xml", async (req, res) => {
  try {
    const Video = require("./models/Video");
    const videos = await Video.find().select("_id slug updatedAt").sort({ createdAt: -1 });
    const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";

    const urls = [
      `<url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      ...videos.map(
        (v) =>
          `<url><loc>${baseUrl}/video/${v._id}</loc><lastmod>${
            v.updatedAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0]
          }</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`
      ),
    ].join("\n    ");

    res.header("Content-Type", "application/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls}
</urlset>`);
  } catch (err) {
    res.status(500).send("Error generating sitemap");
  }
});

// robots.txt
app.get("/robots.txt", (req, res) => {
  const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
  res.type("text/plain");
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml`);
});

// ─── Error Handler ────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Database & Start ─────────────────────────────────────────────

mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/videosite")
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

module.exports = app;
