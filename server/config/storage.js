const { S3Client } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  endpoint: process.env.WASABI_ENDPOINT,
  region: process.env.WASABI_REGION || "eu-central-1",
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY,
    secretAccessKey: process.env.WASABI_SECRET_KEY,
  },
  forcePathStyle: true,
});

module.exports = {
  s3,
  BUCKET: process.env.WASABI_BUCKET,
  CDN_URL: (process.env.CDN_URL || "").replace(/\/$/, ""),
};
