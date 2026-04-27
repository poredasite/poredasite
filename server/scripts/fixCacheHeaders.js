"use strict";
/**
 * R2'deki mevcut dosyalara Cache-Control header'ı ekler.
 * Dosyaları indirip tekrar yüklemez — sadece metadata günceller (CopyObject).
 * Çalıştır: node scripts/fixCacheHeaders.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const {
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} = require("@aws-sdk/client-s3");
const { s3, BUCKET } = require("../config/storage");

const TARGET_CACHE = "public, max-age=31536000, immutable";

// Hangi klasörler/uzantılar immutable cache alacak
const IMMUTABLE_PREFIXES = ["thumbnails/", "fallback/", "videos/"];

// m3u8 küçük cache alacak (segment'ler de immutable ama index değişmez yani değişebilir)
// Aslında bizde her video unique ID ile kaydediliyor, değişmiyor — immutable OK.

async function listAll() {
  const keys = [];
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: token,
    }));
    for (const obj of res.Contents || []) keys.push(obj.Key);
    token = res.NextContinuationToken;
  } while (token);
  return keys;
}

async function run() {
  console.log("R2 dosyaları listeleniyor...");
  const allKeys = await listAll();
  console.log(`Toplam ${allKeys.length} dosya bulundu\n`);

  const targets = allKeys.filter(k =>
    IMMUTABLE_PREFIXES.some(p => k.startsWith(p))
  );
  console.log(`Cache-Control güncellenecek: ${targets.length} dosya\n`);

  let updated = 0, alreadyOk = 0, failed = 0;

  for (const key of targets) {
    try {
      // Mevcut metadata'yı al
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));

      if (head.CacheControl === TARGET_CACHE) {
        alreadyOk++;
        continue;
      }

      const contentType = head.ContentType || "application/octet-stream";

      // In-place metadata güncelle (dosyayı indirmeden)
      await s3.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${key}`,
        Key: key,
        ContentType: contentType,
        CacheControl: TARGET_CACHE,
        MetadataDirective: "REPLACE",
      }));

      updated++;
      if (updated % 50 === 0) console.log(`  ${updated} güncellendi...`);

    } catch (err) {
      failed++;
      console.error(`[FAIL] ${key}: ${err.message}`);
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`Güncellendi  : ${updated}`);
  console.log(`Zaten tamam  : ${alreadyOk}`);
  console.log(`Hata         : ${failed}`);
  console.log("Tamamlandı.");
}

run().catch(err => { console.error(err); process.exit(1); });
