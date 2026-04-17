require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const videosRouter = require("./routes/videos");
const categoriesRouter = require("./routes/categories");
const settingsRouter = require("./routes/settings");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

// ─── Security & Middleware ─────────────────────────────────────────

app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ extended: true, limit: "1gb" }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: "Too many requests, please try again later." },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Upload limit reached, please try again later." },
});

app.use("/api", generalLimiter);
app.use("/api/videos/upload", uploadLimiter);

// ─── Routes ───────────────────────────────────────────────────────

// Admin verify -- EN ÖNCE
app.post("/api/admin/verify", (req, res) => {
  const password = req.headers["x-admin-password"] || req.body.adminPassword;
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!password) return res.status(401).json({ success: false, message: "Password required" });
  if (password.trim() !== adminPassword) return res.status(403).json({ success: false, message: "Invalid password" });
  res.json({ success: true, message: "Authenticated" });
});

app.use("/api/videos", videosRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/settings", settingsRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "poreda API çalışıyor",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    adminSet: !!process.env.ADMIN_PASSWORD,
  });
});

// Sitemap
app.get("/sitemap.xml", async (req, res) => {
  try {
    const Video = require("./models/Video");
    const videos = await Video.find().select("_id slug updatedAt").sort({ createdAt: -1 });
    const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const urls = [
      `<url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      ...videos.map((v) =>
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

// Robots.txt
app.get("/robots.txt", (req, res) => {
  const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
  res.type("text/plain");
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${baseUrl}/sitemap.xml`);
});

// ─── Static Files (Production) ────────────────────────────────────

const clientDist = path.join(__dirname, "../client/dist");
app.use(express.static(clientDist));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

// ─── Error Handler ────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Database & Start ─────────────────────────────────────────────

mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/poreda")
    .then(() => {
      console.log("✅ MongoDB connected");
      const server = app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
      });
      server.timeout = 20 * 60 * 1000; // 20 dakika
      server.keepAliveTimeout = 20 * 60 * 1000;
    })
    .catch((err) => {
      console.error("❌ MongoDB connection failed:", err.message);
      process.exit(1);
    });

module.exports = app;