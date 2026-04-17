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

  upload: (formData, onProgress) =>
    api.post("/videos/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total));
      },
      timeout: 60 * 60 * 1000, // 1 saat (sadece upload süresi)
    }),

  delete: (id) => api.delete(`/videos/${id}`),

  update: (id, data) => api.patch(`/videos/${id}`, data),

  getSitemap: () => api.get("/videos/sitemap"),
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
