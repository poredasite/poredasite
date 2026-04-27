"use strict";
/**
 * DB'deki tüm video URL'lerini eski CDN adresinden yeni CDN adresine günceller.
 *
 * Kullanım:
 *   OLD_CDN=https://pub-xxx.r2.dev  NEW_CDN=https://cdn.xxxporeda.com  node scripts/migrateUrls.js
 *
 * Veya .env'deki CDN_URL otomatik NEW_CDN olarak kullanılır:
 *   OLD_CDN=https://pub-xxx.r2.dev  node scripts/migrateUrls.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");

const OLD_CDN = (process.env.OLD_CDN || "").replace(/\/$/, "");
const NEW_CDN = (process.env.NEW_CDN || process.env.CDN_URL || "").replace(/\/$/, "");

if (!OLD_CDN || !NEW_CDN) {
  console.error("Hata: OLD_CDN ve NEW_CDN env değişkenleri gerekli.");
  console.error("Örnek: OLD_CDN=https://pub-xxx.r2.dev node scripts/migrateUrls.js");
  process.exit(1);
}

if (OLD_CDN === NEW_CDN) {
  console.error("Hata: OLD_CDN ve NEW_CDN aynı, yapacak bir şey yok.");
  process.exit(1);
}

console.log(`\nEski: ${OLD_CDN}`);
console.log(`Yeni: ${NEW_CDN}\n`);

// URL içinde eski CDN'i yeni CDN ile değiştir
function replaceUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (!url.startsWith(OLD_CDN)) return url;
  return NEW_CDN + url.slice(OLD_CDN.length);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB bağlandı");

  const Video = require("../models/Video");

  const videos = await Video.find({
    $or: [
      { thumbnailUrl:    { $regex: OLD_CDN, $options: "i" } },
      { videoUrl:        { $regex: OLD_CDN, $options: "i" } },
      { mp4FallbackUrl:  { $regex: OLD_CDN, $options: "i" } },
      { previewVideoUrl: { $regex: OLD_CDN, $options: "i" } },
    ],
  }).select("_id thumbnailUrl videoUrl mp4FallbackUrl previewVideoUrl").lean();

  console.log(`Güncellenmesi gereken video sayısı: ${videos.length}\n`);
  if (videos.length === 0) {
    console.log("Güncellenecek kayıt yok. Tamamlandı.");
    await mongoose.disconnect();
    return;
  }

  let updated = 0, failed = 0;

  for (const video of videos) {
    const update = {};
    if (video.thumbnailUrl?.includes(OLD_CDN))    update.thumbnailUrl    = replaceUrl(video.thumbnailUrl);
    if (video.videoUrl?.includes(OLD_CDN))         update.videoUrl        = replaceUrl(video.videoUrl);
    if (video.mp4FallbackUrl?.includes(OLD_CDN))   update.mp4FallbackUrl  = replaceUrl(video.mp4FallbackUrl);
    if (video.previewVideoUrl?.includes(OLD_CDN))  update.previewVideoUrl = replaceUrl(video.previewVideoUrl);

    try {
      await Video.updateOne({ _id: video._id }, { $set: update });
      updated++;
    } catch (err) {
      failed++;
      console.error(`[FAIL] ${video._id}: ${err.message}`);
    }
  }

  console.log(`─────────────────────────────────────`);
  console.log(`Güncellendi: ${updated}`);
  console.log(`Hata       : ${failed}`);
  console.log("Tamamlandı.");

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
