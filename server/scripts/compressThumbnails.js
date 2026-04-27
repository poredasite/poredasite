"use strict";
/**
 * Mevcut thumbnail'leri HTTP ile indir, WebP'ye sıkıştır, R2'ye yükle, DB güncelle.
 * Herhangi bir CDN/URL'den çalışır.
 * Çalıştır: node scripts/compressThumbnails.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");
const sharp    = require("sharp");
const https    = require("https");
const http     = require("http");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET, CDN_URL } = require("../config/storage");

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end",  () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB bağlandı");
  console.log(`Yeni CDN: ${CDN_URL}\n`);

  const Video = require("../models/Video");
  const videos = await Video.find({ thumbnailUrl: { $exists: true, $ne: "" } })
    .select("_id thumbnailUrl")
    .lean();

  console.log(`${videos.length} video bulundu\n`);

  let compressed = 0, skipped = 0, failed = 0;
  let totalSavedKB = 0;

  for (const video of videos) {
    const url = video.thumbnailUrl;
    if (!url) { skipped++; continue; }

    const newKey = `thumbnails/${video._id}.webp`;
    const newUrl = `${CDN_URL}/${newKey}`;

    // Zaten yeni CDN'de WebP ise atla
    if (url === newUrl) {
      console.log(`[SKIP] ${video._id}: zaten güncel`);
      skipped++;
      continue;
    }

    try {
      // HTTP ile kaynak URL'den indir
      const inputBuf = await fetchBuffer(url);
      const origKB   = Math.round(inputBuf.length / 1024);

      // Sharp ile sıkıştır → WebP
      const outputBuf = await sharp(inputBuf)
        .resize(1280, 720, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const newKB   = Math.round(outputBuf.length / 1024);
      const savedKB = origKB - newKB;

      // R2'ye yükle
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: newKey,
        Body: outputBuf,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }));

      // DB güncelle
      await Video.updateOne({ _id: video._id }, { thumbnailUrl: newUrl });

      totalSavedKB += savedKB;
      compressed++;
      console.log(`[OK] ${video._id}: ${origKB}KB → ${newKB}KB  (-${savedKB}KB, -%${Math.round((savedKB / origKB) * 100)})`);

    } catch (err) {
      failed++;
      console.error(`[FAIL] ${video._id}: ${err.message}`);
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`Sıkıştırıldı : ${compressed}`);
  console.log(`Atlandı      : ${skipped}`);
  console.log(`Hata         : ${failed}`);
  console.log(`Toplam kazanç: ${Math.round(totalSavedKB / 1024)} MB`);

  await mongoose.disconnect();
  console.log("Tamamlandı.");
}

run().catch(err => { console.error(err); process.exit(1); });
