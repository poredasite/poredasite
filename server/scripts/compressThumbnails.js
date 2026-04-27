"use strict";
/**
 * Mevcut thumbnail'leri R2'den indir, WebP'ye sıkıştır, geri yükle, DB güncelle.
 * Çalıştır: node scripts/compressThumbnails.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose          = require("mongoose");
const sharp             = require("sharp");
const { GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET, CDN_URL } = require("../config/storage");

const OLD_CDN = (process.env.OLD_CDN || "").replace(/\/$/, "");

if (!OLD_CDN) {
  console.error("Hata: OLD_CDN env değişkeni gerekli.");
  console.error("Örnek: OLD_CDN=https://poredasite.b-cdn.net node scripts/compressThumbnails.js");
  process.exit(1);
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB bağlandı");

  const Video = require("../models/Video");
  const videos = await Video.find({ thumbnailUrl: { $exists: true, $ne: "" } })
    .select("_id thumbnailUrl")
    .lean();

  console.log(`${videos.length} video bulundu\n`);
  console.log(`Eski CDN: ${OLD_CDN}`);
  console.log(`Yeni CDN: ${CDN_URL}\n`);

  let compressed = 0, skipped = 0, failed = 0;
  let totalSavedKB = 0;

  for (const video of videos) {
    const url = video.thumbnailUrl;
    if (!url || !url.startsWith(OLD_CDN)) {
      console.log(`[SKIP] ${video._id}: harici URL, atlandı`);
      skipped++;
      continue;
    }

    const oldKey = url.replace(`${OLD_CDN}/`, "");
    const newKey = `thumbnails/${video._id}.webp`;
    const newUrl = `${CDN_URL}/${newKey}`;

    try {
      // R2'den indir
      const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: oldKey }));
      const inputBuf = await streamToBuffer(obj.Body);
      const origKB   = Math.round(inputBuf.length / 1024);

      // Sharp ile sıkıştır → WebP
      const outputBuf = await sharp(inputBuf)
        .resize(1280, 720, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const newKB = Math.round(outputBuf.length / 1024);
      const savedKB = origKB - newKB;

      if (newKB >= origKB && oldKey === newKey) {
        console.log(`[SKIP] ${video._id}: zaten optimal (${origKB}KB)`);
        skipped++;
        continue;
      }

      // R2'ye yükle
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: newKey,
        Body: outputBuf,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000",
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
