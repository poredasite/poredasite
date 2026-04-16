import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 30000,
});

// Attach admin password to admin requests
api.interceptors.request.use((config) => {
  const password = sessionStorage.getItem("adminPassword");
  if (password) {
    config.headers["x-admin-password"] = password;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      "Something went wrong";
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
        if (onProgress) {
          const pct = Math.round((e.loaded * 100) / e.total);
          onProgress(pct);
        }
      },
      timeout: 10 * 60 * 1000, // 10 minutes for uploads
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

export default api;
