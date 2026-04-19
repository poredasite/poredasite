import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const password = sessionStorage.getItem("adminPassword");
  if (password) config.headers["x-admin-password"] = password;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    return Promise.reject(new Error(message));
  }
);

// ─── Video API ────────────────────────────────────────────────────

export const videoApi = {
  getAll: (params = {}) => api.get("/videos", { params }),

  getById: (id) => api.get(`/videos/${id}`),

  initUpload: (formData) =>
    api.post("/videos/upload-init", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    }),

  uploadDirect: (presignedUrl, file, onProgress) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total));
      };
      xhr.onload = () => {
        if (xhr.status < 400) return resolve();
        console.error(`[uploadDirect] R2 PUT failed — HTTP ${xhr.status}`, xhr.responseText?.slice(0, 300));
        reject(new Error(`R2 yükleme başarısız (HTTP ${xhr.status})`));
      };
      xhr.onerror = () => {
        console.error("[uploadDirect] Network error — büyük ihtimalle R2 CORS ayarı eksik");
        reject(new Error("Network hatası — R2 CORS ayarını kontrol et"));
      };
      xhr.ontimeout = () => reject(new Error("Upload zaman aşımı"));
      xhr.open("PUT", presignedUrl);
      xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
      xhr.send(file);
    }),

  processVideo: (id) => api.post(`/videos/${id}/process`),

  delete: (id) => api.delete(`/videos/${id}`),

  update: (id, data) => api.patch(`/videos/${id}`, data),

  search:      (q, params = {}) => api.get("/videos/search", { params: { q, ...params } }),
  getSitemap:  () => api.get("/videos/sitemap"),
  getSidebar:  () => api.get("/videos/sidebar"),
  getByTag:    (tag, params = {}) => api.get(`/videos/tag/${encodeURIComponent(tag)}`, { params }),
  getTagMeta:  (tag) => api.get(`/videos/tag/${encodeURIComponent(tag)}/meta`),
  recordWatch: (id, data) => api.post(`/videos/${id}/watch`, data),
};

// ─── Category API ─────────────────────────────────────────────────

export const categoryApi = {
  getAll: () => api.get("/categories"),
  create: (data) => api.post("/categories", data),
  update: (id, data) => api.patch("/categories/" + id, data),
  delete: (id) => api.delete("/categories/" + id),
};

// ─── Ads / Settings API ───────────────────────────────────────────

export const adsApi = {
  get: () => api.get("/settings/ads"),
  update: (data) => api.patch("/settings/ads", data),
};

export default api;
