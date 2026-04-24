"use strict";
const Video    = require("../models/Video");
const Category = require("../models/Category");

const BASE     = process.env.CLIENT_URL || "https://xxxporeda.com";
const CHUNK    = 50_000;   // max URLs per video sitemap file
const TTL      = 2 * 60 * 60 * 1000; // 2 hours

// ── In-memory cache ───────────────────────────────────────────────────────────
const cache = new Map(); // key → { xml, ts }
const fresh = (k) => { const e = cache.get(k); return e && Date.now() - e.ts < TTL; };
const put   = (k, xml) => { cache.set(k, { xml, ts: Date.now() }); return xml; };

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isoDate(d) {
  try { return new Date(d).toISOString().split("T")[0]; }
  catch { return new Date().toISOString().split("T")[0]; }
}

// ── 1. Sitemap index ──────────────────────────────────────────────────────────
async function getSitemapIndex() {
  if (fresh("index")) return cache.get("index").xml;

  const total  = await Video.countDocuments({ status: "ready" });
  const chunks = Math.max(1, Math.ceil(total / CHUNK));
  const today  = new Date().toISOString().split("T")[0];

  const lines = [];
  for (let i = 1; i <= chunks; i++) {
    const fname = chunks === 1 ? "sitemap-videos.xml" : `sitemap-videos-${i}.xml`;
    lines.push(`  <sitemap><loc>${BASE}/${fname}</loc><lastmod>${today}</lastmod></sitemap>`);
  }
  lines.push(
    `  <sitemap><loc>${BASE}/sitemap-tags.xml</loc><lastmod>${today}</lastmod></sitemap>`,
    `  <sitemap><loc>${BASE}/sitemap-categories.xml</loc><lastmod>${today}</lastmod></sitemap>`
  );

  return put("index",
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    lines.join("\n") + "\n</sitemapindex>"
  );
}

// ── 2. Video sitemap (supports chunks) ───────────────────────────────────────
async function getVideoSitemap(chunk = 1) {
  const key = `videos-${chunk}`;
  if (fresh(key)) return cache.get(key).xml;

  const videos = await Video.find({ status: "ready" })
    .sort({ createdAt: -1 })
    .skip((chunk - 1) * CHUNK)
    .limit(CHUNK)
    .select("_id slug title description thumbnailUrl videoUrl mp4FallbackUrl duration tags createdAt updatedAt")
    .lean();

  const entries = videos.map((v) => {
    const loc     = `${BASE}/video/${v.slug || v._id}`;
    const content = esc(v.mp4FallbackUrl || v.videoUrl || loc);
    const embed   = esc(`${BASE}/embed/${v._id}`);
    const thumb   = esc(v.thumbnailUrl || "");
    const title   = esc(v.title || "");
    const desc    = esc((v.description || "").replace(/<[^>]*>/g, "").slice(0, 200));

    return [
      `  <url>`,
      `    <loc>${esc(loc)}</loc>`,
      `    <lastmod>${isoDate(v.updatedAt || v.createdAt)}</lastmod>`,
      `    <changefreq>weekly</changefreq>`,
      `    <priority>0.8</priority>`,
      `    <video:video>`,
      thumb  ? `      <video:thumbnail_loc>${thumb}</video:thumbnail_loc>` : "",
      title  ? `      <video:title>${title}</video:title>` : "",
      desc   ? `      <video:description>${desc}</video:description>` : "",
      content ? `      <video:content_loc>${content}</video:content_loc>` : "",
      `      <video:player_loc>${embed}</video:player_loc>`,
      v.duration > 0 ? `      <video:duration>${Math.floor(v.duration)}</video:duration>` : "",
      `      <video:publication_date>${isoDate(v.createdAt)}</video:publication_date>`,
      `      <video:family_friendly>no</video:family_friendly>`,
      `      <video:requires_subscription>no</video:requires_subscription>`,
      ...(v.tags?.slice(0, 32).map(t => `      <video:tag>${esc(t)}</video:tag>`) || []),
      `    </video:video>`,
      `  </url>`,
    ].filter(Boolean).join("\n");
  });

  return put(key,
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n` +
    entries.join("\n") + "\n</urlset>"
  );
}

// ── 3. Tag sitemap ────────────────────────────────────────────────────────────
async function getTagSitemap() {
  if (fresh("tags")) return cache.get("tags").xml;

  const rows = await Video.aggregate([
    { $match:  { status: "ready" } },
    { $unwind: "$tags" },
    { $group:  { _id: "$tags", count: { $sum: 1 }, lastmod: { $max: "$updatedAt" } } },
    { $sort:   { count: -1 } },
    { $limit:  5000 },
  ]);

  const entries = rows.map(({ _id: tag, count, lastmod }) => {
    const priority = Math.min(0.9, 0.4 + Math.log10(count + 1) * 0.2).toFixed(1);
    const slug     = encodeURIComponent(tag.toLowerCase().replace(/\s+/g, "-"));
    return [
      `  <url>`,
      `    <loc>${BASE}/tag/${slug}</loc>`,
      `    <lastmod>${isoDate(lastmod)}</lastmod>`,
      `    <changefreq>daily</changefreq>`,
      `    <priority>${priority}</priority>`,
      `  </url>`,
    ].join("\n");
  });

  return put("tags",
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") + "\n</urlset>"
  );
}

// ── 4. Category sitemap ───────────────────────────────────────────────────────
async function getCategorySitemap() {
  if (fresh("categories")) return cache.get("categories").xml;

  const cats = await Category.find().select("_id name slug updatedAt").lean();

  const home = `  <url>\n    <loc>${BASE}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`;

  const entries = cats
    .filter((c) => c.slug)
    .map((c) => [
      `  <url>`,
      `    <loc>${BASE}/kategori/${esc(c.slug)}</loc>`,
      `    <lastmod>${isoDate(c.updatedAt)}</lastmod>`,
      `    <changefreq>daily</changefreq>`,
      `    <priority>0.8</priority>`,
      `  </url>`,
    ].join("\n"));

  return put("categories",
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    home + "\n" + entries.join("\n") + "\n</urlset>"
  );
}

// ── Invalidate all (call on video add/process) ────────────────────────────────
function invalidateCache() { cache.clear(); }

async function buildAll() {
  await Promise.allSettled([
    getSitemapIndex(),
    getVideoSitemap(1),
    getTagSitemap(),
    getCategorySitemap(),
  ]);
}

// ── Initial warm-up on server start ──────────────────────────────────────────
async function warmup() {
  try {
    await buildAll();
    console.log("[Sitemap] Initial cache built");
  } catch (e) {
    console.error("[Sitemap] Warmup error:", e.message);
  }
}

// ── Scheduled warm-up every 2 hours ──────────────────────────────────────────
function startScheduler() {
  setInterval(async () => {
    cache.clear();
    try {
      await buildAll();
      console.log("[Sitemap] Cache refreshed");
    } catch (e) {
      console.error("[Sitemap] Refresh error:", e.message);
    }
  }, TTL);
}

module.exports = {
  getSitemapIndex,
  getVideoSitemap,
  getCategorySitemap,
  getTagSitemap,
  invalidateCache,
  warmup,
  startScheduler,
};
