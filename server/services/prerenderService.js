"use strict";
const Video    = require("../models/Video");
const Category = require("../models/Category");

const BASE      = process.env.CLIENT_URL || "https://xxxporeda.com";
const SITE_NAME = "xxxporeda";

const BOT_UA = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|rogerbot/i;

function isBot(ua) { return BOT_UA.test(ua || ""); }

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(s) {
  return (s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function isoDuration(s) {
  if (!s || s <= 0) return "PT0S";
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${sec || (!h && !m) ? `${sec}S` : ""}`;
}

function videoSchema(video) {
  const url   = `${BASE}/video/${video._id}`;
  const embed = `${BASE}/embed/${video._id}`;
  const desc  = stripHtml(video.description || "").slice(0, 200) || `${video.title} — ${SITE_NAME}`;

  const schema = {
    "@context": "https://schema.org",
    "@type":    "VideoObject",
    name:          video.title || "",
    description:   desc,
    thumbnailUrl:  [video.thumbnailUrl].filter(Boolean),
    uploadDate:    new Date(video.createdAt).toISOString(),
    duration:      isoDuration(video.duration),
    contentUrl:    video.mp4FallbackUrl || video.videoUrl || url,
    embedUrl:      embed,
    url,
    publisher: {
      "@type": "Organization",
      name:    SITE_NAME,
      url:     BASE,
      logo:    { "@type": "ImageObject", url: `${BASE}/logo.png`, width: 600, height: 60 },
    },
    potentialAction: { "@type": "WatchAction", target: url },
  };

  if (video.views > 0) {
    schema.interactionStatistic = {
      "@type":              "InteractionCounter",
      interactionType:      { "@type": "WatchAction" },
      userInteractionCount: video.views,
    };
  }

  if (video.duration > 60) {
    const start = Math.floor(video.duration * 0.15);
    schema.hasPart = {
      "@type":       "Clip",
      name:          "Highlight",
      startOffset:   start,
      endOffset:     Math.min(start + 60, video.duration),
      url,
    };
  }

  return JSON.stringify(schema).replace(/<\/script>/gi, "<\\/script>");
}

function breadcrumbSchema(items) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type":    "ListItem",
      position:   i + 1,
      name:       item.name,
      item:       item.url,
    })),
  }).replace(/<\/script>/gi, "<\\/script>");
}

function page(head, body) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${head}
</head>
<body>
${body}
</body>
</html>`;
}

// ── /video/:id ────────────────────────────────────────────────────────────────
async function renderVideo(id) {
  const video = await Video.findById(id)
    .populate("categories", "name _id")
    .populate("category",   "name _id")
    .lean();

  if (!video || video.status !== "ready") return null;

  const related = await Video.find({
    status: "ready",
    _id:    { $ne: video._id },
    $or: [
      { tags:       { $in: video.tags       || [] } },
      { categories: { $in: (video.categories || []).map(c => c._id) } },
    ],
  })
    .sort({ views: -1 })
    .limit(10)
    .select("_id title")
    .lean();

  const url       = `${BASE}/video/${video._id}`;
  const desc      = esc(stripHtml(video.description || "").slice(0, 160) || `${video.title} — ${SITE_NAME}`);
  const titleEsc  = esc(video.title);
  const fullTitle = `${titleEsc} — ${SITE_NAME}`;
  const tags      = video.tags || [];
  const cats      = [...(video.categories || []), ...(video.category ? [video.category] : [])];

  const head = `<title>${fullTitle}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="video.other">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="${SITE_NAME}">
${video.thumbnailUrl ? `<meta property="og:image" content="${esc(video.thumbnailUrl)}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="720">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(video.thumbnailUrl)}">` : `<meta name="twitter:card" content="summary">`}
<meta name="twitter:title" content="${fullTitle}">
<meta name="twitter:description" content="${desc}">
<script type="application/ld+json">${videoSchema(video)}</script>
<script type="application/ld+json">${breadcrumbSchema([
  { name: SITE_NAME,    url: BASE },
  { name: video.title,  url },
])}</script>`;

  const tagLinks  = tags.map(t =>
    `<a href="${BASE}/tag/${encodeURIComponent(t.toLowerCase())}">#${esc(t)}</a>`).join(" ");
  const catLinks  = cats.map(c =>
    `<a href="${BASE}/?category=${c._id}">${esc(c.name)}</a>`).join(", ");
  const relLinks  = related.map(v =>
    `<li><a href="${BASE}/video/${v._id}">${esc(v.title)}</a></li>`).join("\n");

  const body = `<h1>${titleEsc}</h1>
${video.thumbnailUrl ? `<img src="${esc(video.thumbnailUrl)}" alt="${titleEsc}" width="1280" height="720">` : ""}
${video.description  ? `<p>${esc(stripHtml(video.description).slice(0, 500))}</p>` : ""}
${tagLinks  ? `<p>Etiketler: ${tagLinks}</p>` : ""}
${catLinks  ? `<p>Kategoriler: ${catLinks}</p>` : ""}
${relLinks  ? `<h2>Benzer Videolar</h2><ul>${relLinks}</ul>` : ""}
<p><a href="${BASE}">← Ana Sayfa</a></p>`;

  return page(head, body);
}

// ── /tag/:tag ─────────────────────────────────────────────────────────────────
async function renderTag(tag) {
  const decoded = decodeURIComponent(tag);
  const videos  = await Video.find({ status: "ready", tags: decoded })
    .sort({ views: -1 })
    .limit(20)
    .select("_id title")
    .lean();

  const url       = `${BASE}/tag/${encodeURIComponent(decoded.toLowerCase())}`;
  const titleEsc  = esc(decoded);
  const fullTitle = `${titleEsc} videoları — ${SITE_NAME}`;
  const desc      = `${titleEsc} etiketli en iyi videolar ${SITE_NAME}'de.`;

  const head = `<title>${fullTitle}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${esc(url)}">
<script type="application/ld+json">${breadcrumbSchema([
  { name: SITE_NAME,         url: BASE },
  { name: `${decoded} videoları`, url },
])}</script>`;

  const videoLinks = videos.map(v =>
    `<li><a href="${BASE}/video/${v._id}">${esc(v.title)}</a></li>`).join("\n");

  const body = `<h1>${fullTitle}</h1>
${videoLinks ? `<ul>${videoLinks}</ul>` : "<p>Video bulunamadı.</p>"}
<p><a href="${BASE}">← Ana Sayfa</a></p>`;

  return page(head, body);
}

// ── / (home) ──────────────────────────────────────────────────────────────────
async function renderHome() {
  const [videos, categories] = await Promise.all([
    Video.find({ status: "ready" })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("_id title")
      .lean(),
    Category.find().select("_id name").lean(),
  ]);

  const fullTitle = `${SITE_NAME} — Porno izle`;
  const desc      = `Türkiye'nin en iyi porno platformu. En yeni ve popüler videolar.`;

  const head = `<title>${fullTitle}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(BASE)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(BASE)}">`;

  const videoLinks = videos.map(v =>
    `<li><a href="${BASE}/video/${v._id}">${esc(v.title)}</a></li>`).join("\n");
  const catLinks   = categories.map(c =>
    `<li><a href="${BASE}/?category=${c._id}">${esc(c.name)}</a></li>`).join("\n");

  const body = `<h1>${SITE_NAME}</h1>
<h2>Kategoriler</h2>
<ul>${catLinks}</ul>
<h2>Son Videolar</h2>
<ul>${videoLinks}</ul>`;

  return page(head, body);
}

module.exports = { isBot, renderVideo, renderTag, renderHome };
