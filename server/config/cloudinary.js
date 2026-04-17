const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper: buffer'ı cloudinary'ye yükle (Railway uyumlu)
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      ...options,
      timeout: 600000, // 10 dakika
      chunk_size: 20000000, // 20MB chunk
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    const { Readable } = require("stream");
    Readable.from(buffer).pipe(stream);
  });
};

module.exports = { cloudinary, uploadToCloudinary };
