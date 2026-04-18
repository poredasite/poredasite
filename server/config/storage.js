const { S3Client } = require("@aws-sdk/client-s3");

// Cloudflare R2 — S3-compatible
// Endpoint format: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
const s3 = new S3Client({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "when_required",
  responseChecksumValidation: "when_required",
});

module.exports = {
  s3,
  BUCKET: process.env.R2_BUCKET,
  CDN_URL: (process.env.CDN_URL || "").replace(/\/$/, ""),
};
