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
      // Railway'de timeout sorunlarını önle
      timeout: 120000,
      chunk_size: 6000000, // 6MB chunk
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    // Buffer'ı parçalar halinde gönder (büyük dosyalar için)
    const chunkSize = 64 * 1024; // 64KB
    let offset = 0;

    function writeChunk() {
      if (offset >= buffer.length) {
        stream.end();
        return;
      }
      const chunk = buffer.slice(offset, offset + chunkSize);
      offset += chunkSize;
      const canContinue = stream.write(chunk);
      if (canContinue) {
        writeChunk();
      } else {
        stream.once("drain", writeChunk);
      }
    }

    writeChunk();
  });
};

module.exports = { cloudinary, uploadToCloudinary };
