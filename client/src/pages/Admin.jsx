import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { videoApi, categoryApi, adsApi } from "../api";
import { useAdmin } from "../context/AdminContext";
import { useAds } from "../context/AdsContext";
import SEOHead from "../components/SEOHead";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

// ─── Admin Login ──────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true); setError("");
    try {
      const apiUrl = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";
      const res = await fetch(`${apiUrl}/api/admin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid password");
      onLogin(password);
      toast.success("Giriş başarılı");
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Sunucuya ulaşılamıyor." : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-2xl text-white">Yönetici Girişi</h1>
          <p className="text-gray-600 text-sm mt-1">Şifreni gir</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Yönetici şifresi" autoFocus
            className="w-full bg-surface-800 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-4 py-3 rounded-xl text-sm outline-none transition-colors" />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" disabled={loading || !password}
            className="btn-primary w-full justify-center flex items-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Doğrulanıyor...</> : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Multi Upload Queue ───────────────────────────────────────────
const SPECIAL_TAGS = [
  { id: "turk",      label: "Türk Videoları",    tag: "türk" },
  { id: "altyazili", label: "Türkçe Altyazılı",  tag: "türkçe altyazılı" },
  { id: "ifsa",      label: "Türk İfşa",         tag: "türk ifşa" },
];

const CATEGORY_SECTIONS = [
  { key: null,               label: "Genel" },
  { key: "türk",             label: "Türk Videoları" },
  { key: "türkçe altyazılı", label: "Türkçe Altyazılı" },
  { key: "türk ifşa",        label: "Türk İfşa" },
];

function emptyItem() {
  return { id: Date.now() + Math.random(), title: "", description: "", tags: "", specialTags: [], categories: [], thumbFile: null, thumbPreview: null, videoFile: null, status: "idle", progress: 0, errorMsg: null };
}

function SectionDropdown({ value = [], onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle(tag) {
    onChange(value.includes(tag) ? value.filter(t => t !== tag) : [...value, tag]);
  }

  function addCustom() {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed || value.includes(trimmed)) { setInput(""); return; }
    onChange([...value, trimmed]);
    setInput("");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-surface-700 border border-white/8 hover:border-brand-500/40 rounded-lg text-left transition-colors disabled:opacity-50 min-h-[38px]"
      >
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {value.length === 0
            ? <span className="text-gray-600 text-xs">Bölüm seç veya ekle...</span>
            : value.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-brand-500/20 text-brand-300 text-xs px-2 py-0.5 rounded-full">
                  🇹🇷 {tag}
                  {!disabled && (
                    <button type="button" onClick={e => { e.stopPropagation(); toggle(tag); }} className="hover:text-white leading-none">×</button>
                  )}
                </span>
              ))
          }
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-800 border border-white/10 rounded-xl shadow-2xl shadow-black/60 z-50">
          <div className="p-2 space-y-0.5">
            {SPECIAL_TAGS.map(({ tag, label }) => (
              <label key={tag} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-700 cursor-pointer transition-colors">
                <input type="checkbox" checked={value.includes(tag)} onChange={() => toggle(tag)} className="w-4 h-4 accent-brand-500 flex-shrink-0" />
                <span className="text-sm text-gray-300">🇹🇷 {label}</span>
              </label>
            ))}
          </div>
          <div className="border-t border-white/8 p-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                placeholder="Özel bölüm ekle..."
                className="flex-1 bg-surface-700 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-3 py-1.5 rounded-lg text-xs outline-none"
              />
              <button type="button" onClick={addCustom} className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs rounded-lg transition-colors font-medium">
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryMultiSelect({ allCategories, selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allCategories.map(cat => {
        const active = selected.includes(cat._id);
        return (
          <button
            key={cat._id}
            type="button"
            onClick={() => onChange(active ? selected.filter(id => id !== cat._id) : [...selected, cat._id])}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              active ? "bg-brand-500 text-white" : "bg-surface-700 text-gray-400 hover:bg-surface-600"
            }`}
          >
            {cat.name}
          </button>
        );
      })}
      {allCategories.length === 0 && <span className="text-xs text-gray-600">Kategori yok — önce oluştur</span>}
    </div>
  );
}

function UploadItemCard({ item, allCategories, onUpdate, onRemove }) {
  const thumbRef = useRef(null);
  const videoRef = useRef(null);

  function handleThumb(e) {
    const file = e.target.files[0];
    if (!file) return;
    onUpdate({ thumbFile: file, thumbPreview: URL.createObjectURL(file) });
  }

  const isActive = item.status !== "idle";
  const isDone = item.status === "done";
  const isError = item.status === "error";

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      isDone ? "border-green-500/30 bg-green-500/5" :
      isError ? "border-red-500/30 bg-red-500/5" :
      "border-white/8 bg-surface-800/50"
    }`}>
      <div className="flex gap-4">
        {/* Thumbnail picker */}
        <div className="flex-shrink-0">
          <div
            className="w-32 sm:w-40 aspect-video rounded-lg border-2 border-dashed border-white/10 hover:border-brand-500/40 bg-surface-800 overflow-hidden cursor-pointer relative"
            onClick={() => !isActive && thumbRef.current?.click()}
          >
            {item.thumbPreview
              ? <img src={item.thumbPreview} alt="" className="w-full h-full object-cover" />
              : <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center">
                  <svg className="w-6 h-6 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M21 3v18" />
                  </svg>
                  <span className="text-[10px] text-gray-600 leading-tight">Thumbnail<br/><span className="text-[9px] text-gray-700">opsiyonel</span></span>
                </div>
            }
            <input ref={thumbRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleThumb} className="hidden" />
          </div>
        </div>

        {/* Form fields */}
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={item.title}
              onChange={e => onUpdate({ title: e.target.value })}
              placeholder="Başlık *"
              disabled={isActive}
              maxLength={200}
              className="flex-1 bg-surface-700 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-3 py-2 rounded-lg text-sm outline-none transition-colors disabled:opacity-50"
            />
            {!isActive && (
              <button onClick={onRemove} type="button" className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Video file picker */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-all
              ${item.videoFile ? "border-brand-500/30 bg-brand-500/5" : "border-white/8 hover:border-brand-500/30 bg-surface-700"}`}
            onClick={() => !isActive && videoRef.current?.click()}
          >
            <svg className={`w-4 h-4 flex-shrink-0 ${item.videoFile ? "text-brand-500" : "text-gray-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className={`text-xs truncate ${item.videoFile ? "text-brand-400" : "text-gray-600"}`}>
              {item.videoFile ? `${item.videoFile.name} (${(item.videoFile.size / 1024 / 1024).toFixed(1)} MB)` : "Video seç *"}
            </span>
            <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/avi,video/x-matroska,video/webm"
              onChange={e => onUpdate({ videoFile: e.target.files[0] })} className="hidden" />
          </div>

          {/* Special sections */}
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Bölüm</p>
            <SectionDropdown
              value={item.specialTags || []}
              onChange={tags => onUpdate({ specialTags: tags })}
              disabled={isActive}
            />
          </div>

          {/* Categories — filtered by selected sections */}
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Kategoriler</p>
            <CategoryMultiSelect
              allCategories={allCategories.filter(cat =>
                !cat.section || (item.specialTags || []).includes(cat.section)
              )}
              selected={item.categories}
              onChange={cats => onUpdate({ categories: cats })}
            />
          </div>

          {/* Description */}
          <textarea
            value={item.description}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="Açıklama (SEO için önemli)"
            disabled={isActive}
            rows={3}
            maxLength={5000}
            className="w-full bg-surface-700 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-3 py-2 rounded-lg text-sm outline-none transition-colors disabled:opacity-50 resize-none"
          />

          {/* Tags */}
          <input
            type="text"
            value={item.tags}
            onChange={e => onUpdate({ tags: e.target.value })}
            placeholder="Etiketler (virgülle ayır)"
            disabled={isActive}
            className="w-full bg-surface-700 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-3 py-2 rounded-lg text-xs outline-none transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      {/* Status bar */}
      {item.status !== "idle" && (
        <div className="mt-3">
          {item.status === "uploading" && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Depolamaya yükleniyor...</span>
                <span className="font-mono text-brand-400">{item.progress}%</span>
              </div>
              <div className="h-1 bg-surface-700 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
              </div>
            </div>
          )}
          {item.status === "processing" && (
            <div className="flex items-center gap-2 text-xs text-brand-400">
              <div className="w-3.5 h-3.5 border-2 border-brand-500/30 border-t-brand-400 rounded-full animate-spin" />
              HLS dönüştürülüyor...
            </div>
          )}
          {item.status === "done" && (
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Tamamlandı
            </p>
          )}
          {item.status === "error" && (
            <p className="text-xs text-red-400 flex items-start gap-1.5">
              <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {item.errorMsg || "Yükleme başarısız"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MultiUploadQueue({ onSuccess }) {
  const [items, setItems] = useState([emptyItem()]);
  const [allCategories, setAllCategories] = useState([]);
  const [uploading, setUploading] = useState(false);
  const pollRefs = useRef({});

  useEffect(() => {
    categoryApi.getAll().then(res => setAllCategories(res.data)).catch(() => {});
    return () => Object.values(pollRefs.current).forEach(clearInterval);
  }, []);

  function addItem() {
    setItems(prev => [...prev, emptyItem()]);
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function updateItem(id, changes) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...changes } : i));
  }

  async function uploadSingle(item) {
    updateItem(item.id, { status: "uploading", progress: 0, errorMsg: null });
    const fail = (msg) => {
      updateItem(item.id, { status: "error", errorMsg: msg });
      toast.error(`"${item.title}": ${msg}`);
    };

    let videoId;
    try {
      const fd = new FormData();
      const manualTags = (item.tags || "").split(",").map(t => t.trim()).filter(Boolean);
      const allTags = [...new Set([...(item.specialTags || []), ...manualTags])].join(", ");

      fd.append("title", item.title.trim());
      fd.append("description", item.description?.trim() || "");
      fd.append("tags", allTags);
      fd.append("categories", JSON.stringify(item.categories || []));
      if (item.thumbFile) fd.append("thumbnail", item.thumbFile);
      fd.append("videoType", item.videoFile.type || "video/mp4");

      const initRes = await videoApi.initUpload(fd);
      videoId = initRes.data.videoId;
      const uploadUrl = initRes.data.uploadUrl;

      await videoApi.uploadDirect(uploadUrl, item.videoFile, (p) => updateItem(item.id, { progress: p }));
    } catch (err) {
      // Fails here = init (thumbnail/auth) or direct R2 upload
      return fail(err.message);
    }

    updateItem(item.id, { status: "processing", progress: 0 });

    try {
      await videoApi.processVideo(videoId);
    } catch (err) {
      return fail(`FFmpeg başlatılamadı: ${err.message}`);
    }

    pollRefs.current[item.id] = setInterval(async () => {
      try {
        const statusRes = await videoApi.getById(videoId);
        const s = statusRes.data?.status;
        if (s === "ready") {
          clearInterval(pollRefs.current[item.id]);
          updateItem(item.id, { status: "done" });
          onSuccess?.();
        } else if (s === "error") {
          clearInterval(pollRefs.current[item.id]);
          fail("FFmpeg encode başarısız — sunucu logunu kontrol et");
        }
      } catch {}
    }, 2000);
  }

  async function uploadAll() {
    const pending = items.filter(i => i.status === "idle" && i.title?.trim() && i.videoFile);
    if (pending.length === 0) {
      toast.error("Başlık ve video dosyası dolu olan video yok");
      return;
    }
    setUploading(true);

    // Max 3 paralel upload
    const CONCURRENCY = 3;
    const chunks = [];
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      chunks.push(pending.slice(i, i + CONCURRENCY));
    }
    for (const chunk of chunks) {
      await Promise.allSettled(chunk.map(item => uploadSingle(item)));
    }

    setUploading(false);
  }

  const pendingCount = items.filter(i => i.status === "idle" && i.title?.trim() && i.videoFile).length;
  const doneCount = items.filter(i => i.status === "done").length;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map(item => (
          <UploadItemCard
            key={item.id}
            item={item}
            allCategories={allCategories}
            onUpdate={(changes) => updateItem(item.id, changes)}
            onRemove={() => removeItem(item.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-2 rounded-lg border border-white/8 hover:border-white/20 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Video Ekle
        </button>

        <button
          type="button"
          onClick={uploadAll}
          disabled={uploading || pendingCount === 0}
          className="btn-primary flex items-center gap-2"
        >
          {uploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {uploading ? "Yükleniyor..." : `Yükle${pendingCount > 1 ? ` (${pendingCount} video)` : ""}`}
        </button>

        {doneCount > 0 && (
          <span className="text-sm text-green-400">{doneCount} video tamamlandı</span>
        )}
      </div>
    </div>
  );
}

// ─── Ads Manager ─────────────────────────────────────────────────
const AD_SLOT_DEFS = [
  { key: "topBanner",      icon: "—",  label: "Üst Banner",        desc: "Ana sayfanın üstünde gösterilir",                              presets: { desktop: [["728","90"],["970","90"],["970","250"]], mobile: [["320","50"],["320","100"],["300","50"]] } },
  { key: "sidebar",        icon: "||", label: "Kenar Çubuğu",      desc: "Sol/sağ sütunda sabit durur",                                  presets: { desktop: [["300","250"],["300","600"],["160","600"]], mobile: [["300","250"],["320","100"]] } },
  { key: "inFeed",         icon: "▪",  label: "Feed İçi",          desc: "Video kartları arasında çıkar",                               presets: { desktop: [["336","280"],["300","250"],["728","90"]], mobile: [["300","250"],["320","100"]] } },
  { key: "stickyBanner",   icon: "↓",  label: "Alt Yapışkan",      desc: "Sayfanın altına sabitlenir",                                  presets: { desktop: [["728","90"],["970","90"]], mobile: [["320","50"],["320","100"]] } },
  { key: "popunder",       icon: "↗",  label: "Popunder",          desc: "İlk tıklamada arka planda sekme açar",                        presets: { desktop: [], mobile: [] }, noSize: true },
  { key: "instreamVideo",  icon: "▶",  label: "Video Öncesi",      desc: "Video oynatılmadan önce gösterilir",                          presets: { desktop: [["100%","480"],["100%","360"]], mobile: [["100%","240"],["100%","180"]] } },
  { key: "instantMessage",   icon: "◻",  label: "Tam Ekran",       desc: "Sayfa yüklenmesinden 2sn sonra tam ekran overlay",            presets: { desktop: [["800","600"],["640","480"]], mobile: [["320","480"],["300","250"]] } },
  { key: "belowDescription", icon: "≡",  label: "Açıklama Altı",  desc: "Video sayfasında açıklama/etiketlerin altında gösterilir",     presets: { desktop: [["728","90"],["970","90"],["300","250"]], mobile: [["300","250"],["320","100"]] } },
];

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${value ? "bg-brand-500" : "bg-surface-600"}`}>
      <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function DevicePanel({ slotDef, device, data, onChange }) {
  const presets = slotDef.presets[device] || [];
  function set(field, val) { onChange({ ...data, [field]: val }); }
  const isPresetActive = (w, h) => data.width === w && data.height === h;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{device === "desktop" ? "Masaüstü" : "Mobil"}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${data.enabled ? "text-green-400" : "text-gray-600"}`}>{data.enabled ? "Açık" : "Kapalı"}</span>
          <Toggle value={data.enabled} onChange={v => set("enabled", v)} />
        </div>
      </div>
      {!slotDef.noSize && (
        <div>
          <div className="flex flex-wrap gap-1 mb-2">
            {presets.map(([w, h]) => (
              <button key={`${w}x${h}`} type="button" onClick={() => onChange({ ...data, width: w, height: h })}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${isPresetActive(w, h) ? "bg-brand-500 text-white" : "bg-surface-700 text-gray-500 hover:bg-surface-600"}`}>
                {w}×{h}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <input type="text" value={data.width || ""} onChange={e => set("width", e.target.value)} placeholder="Genişlik"
              className="flex-1 bg-surface-700 border border-white/8 text-white placeholder-gray-600 px-2 py-1.5 rounded-lg text-xs outline-none focus:border-brand-500" />
            <span className="text-gray-700 text-xs">×</span>
            <input type="text" value={data.height || ""} onChange={e => set("height", e.target.value)} placeholder="Yükseklik"
              className="flex-1 bg-surface-700 border border-white/8 text-white placeholder-gray-600 px-2 py-1.5 rounded-lg text-xs outline-none focus:border-brand-500" />
          </div>
        </div>
      )}
      {slotDef.key === "instreamVideo" ? (
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">VAST URL</label>
          <input
            type="text"
            value={data.vastUrl || ""}
            onChange={e => set("vastUrl", e.target.value)}
            placeholder="https://s.magsrv.com/v1/vast.php?idzone=..."
            className="w-full bg-surface-700 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-2.5 py-2 rounded-lg text-xs font-mono outline-none"
          />
          <p className="text-[10px] text-gray-600">VAST URL girilirse IMA SDK ile oynatılır. Alternatif olarak aşağıya HTML kodu da girebilirsin.</p>
          <textarea value={data.code || ""} onChange={e => set("code", e.target.value)}
            placeholder="<!-- alternatif HTML kodu (VAST URL yoksa kullanılır) -->"
            rows={3}
            className="w-full bg-surface-700 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-2.5 py-2 rounded-lg text-xs font-mono outline-none resize-y" />
        </div>
      ) : (
        <textarea value={data.code || ""} onChange={e => set("code", e.target.value)}
          placeholder={`<!-- ${slotDef.label} ${device === "mobile" ? "mobil" : "masaüstü"} kodu -->`}
          rows={4}
          className="w-full bg-surface-700 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-2.5 py-2 rounded-lg text-xs font-mono outline-none resize-y" />
      )}
    </div>
  );
}

function AdsManager() {
  const { ads, setAds } = useAds();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeSlot, setActiveSlot] = useState("topBanner");

  useEffect(() => { if (ads) setForm(JSON.parse(JSON.stringify(ads))); }, [ads]);
  if (!form) return <div className="skeleton h-40 rounded-xl" />;

  function updateDevice(slotKey, device, data) {
    setForm(prev => ({ ...prev, [slotKey]: { ...prev[slotKey], [device]: data } }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adsApi.update(form);
      setAds(res.data);
      setForm(JSON.parse(JSON.stringify(res.data)));
      toast.success("Reklam ayarları kaydedildi");
    } catch (err) {
      toast.error("Kaydetme hatası: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  const activeDef = AD_SLOT_DEFS.find(s => s.key === activeSlot);
  const activeData = form[activeSlot] || { desktop: {}, mobile: {} };
  const isAnyEnabled = (key) => form[key]?.desktop?.enabled || form[key]?.mobile?.enabled;

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1">
        {AD_SLOT_DEFS.map(slot => (
          <button key={slot.key} type="button" onClick={() => setActiveSlot(slot.key)}
            className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-center transition-all relative
              ${activeSlot === slot.key ? "bg-brand-500 text-white" : "bg-surface-800 text-gray-500 hover:text-white hover:bg-surface-700"}`}>
            <span className="text-sm font-mono leading-none">{slot.icon}</span>
            <span className="text-[10px] font-medium leading-tight">{slot.label}</span>
            {isAnyEnabled(slot.key) && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-green-400" />}
          </button>
        ))}
      </div>

      {activeDef && (
        <div className="bg-surface-800/40 rounded-xl p-5 border border-white/5 space-y-5">
          <div>
            <h3 className="font-display font-semibold text-white">{activeDef.label}</h3>
            <p className="text-gray-600 text-xs mt-0.5">{activeDef.desc}</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-surface-900/60 rounded-xl p-4 border border-white/5">
              <DevicePanel slotDef={activeDef} device="desktop" data={activeData.desktop || {}} onChange={data => updateDevice(activeSlot, "desktop", data)} />
            </div>
            <div className="bg-surface-900/60 rounded-xl p-4 border border-white/5">
              <DevicePanel slotDef={activeDef} device="mobile" data={activeData.mobile || {}} onChange={data => updateDevice(activeSlot, "mobile", data)} />
            </div>
          </div>
        </div>
      )}

      <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
        {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        {saving ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </form>
  );
}

// ─── Kategori Manager ─────────────────────────────────────────────
function KategoriManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(null); // null = Genel
  const [form, setForm] = useState({ name: "", icon: "🎬", description: "", color: "#ff6b00" });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const PRESET_ICONS = ["🎬","🎮","🎵","📚","🏆","🍕","✈️","💡","🎨","🔬","💪","😂","🌍","🐾","👗","🏠"];

  useEffect(() => { loadCategories(); }, []);

  async function loadCategories() {
    setLoading(true);
    try { const res = await categoryApi.getAll(); setCategories(res.data); }
    catch { toast.error("Kategoriler yüklenemedi"); }
    finally { setLoading(false); }
  }

  function startEdit(cat) {
    setEditingId(cat._id);
    setForm({ name: cat.name, icon: cat.icon, description: cat.description || "", color: cat.color || "#ff6b00" });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm({ name: "", icon: "🎬", description: "", color: "#ff6b00" });
  }

  function switchSection(key) {
    setActiveSection(key);
    cancelEdit();
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("İsim zorunlu"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const res = await categoryApi.update(editingId, { ...form, section: activeSection });
        setCategories(cats => cats.map(c => c._id === editingId ? res.data : c));
        toast.success("Kategori güncellendi");
      } else {
        const res = await categoryApi.create({ ...form, section: activeSection });
        setCategories(cats => [...cats, res.data]);
        toast.success("Kategori oluşturuldu");
      }
      cancelEdit();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleSil(id, name) {
    if (!window.confirm(`"${name}" kategorisini sil?`)) return;
    setDeleting(id);
    try {
      await categoryApi.delete(id);
      setCategories(cats => cats.filter(c => c._id !== id));
      toast.success("Silindi");
    } catch (err) { toast.error(err.message); }
    finally { setDeleting(null); }
  }

  const visibleCategories = categories.filter(cat =>
    activeSection === null ? !cat.section : cat.section === activeSection
  );

  return (
    <div className="space-y-5">
      {/* Section tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
        {CATEGORY_SECTIONS.map(sec => (
          <button
            key={String(sec.key)}
            onClick={() => switchSection(sec.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === sec.key
                ? "bg-brand-500 text-white"
                : "bg-surface-800 text-gray-400 hover:text-white hover:bg-surface-700"
            }`}
          >
            {sec.key ? "🇹🇷 " : ""}{sec.label}
          </button>
        ))}
      </div>

      {/* Create / Edit form */}
      <div className="bg-surface-800/40 rounded-xl p-5 border border-white/5">
        <h3 className="font-display font-semibold text-white mb-4 text-sm">
          {editingId ? "Düzenle" : `Yeni Kategori — ${CATEGORY_SECTIONS.find(s => s.key === activeSection)?.label}`}
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="İsim *" maxLength={50}
              className="w-full bg-surface-700 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-3 py-2 rounded-lg text-sm outline-none" />
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Açıklama (opsiyonel)" maxLength={200}
              className="w-full bg-surface-700 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-3 py-2 rounded-lg text-sm outline-none" />
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-2">İkon</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ICONS.map(emoji => (
                <button key={emoji} type="button" onClick={() => setForm({ ...form, icon: emoji })}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all
                    ${form.icon === emoji ? "bg-brand-500/20 border-2 border-brand-500" : "bg-surface-700 hover:bg-surface-600 border-2 border-transparent"}`}>
                  {emoji}
                </button>
              ))}
              <input type="text" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
                maxLength={2} placeholder="✨"
                className="w-9 h-9 bg-surface-700 border-2 border-white/8 focus:border-brand-500 text-center text-lg rounded-lg outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingId ? "Kaydet" : "Oluştur"}
            </button>
            {editingId && <button type="button" onClick={cancelEdit} className="btn-ghost">İptal</button>}
          </div>
        </form>
      </div>

      {/* Category list for active section */}
      <div>
        <h3 className="font-display font-semibold text-white mb-3 text-sm">
          {CATEGORY_SECTIONS.find(s => s.key === activeSection)?.label} Kategorileri
          <span className="ml-2 text-gray-600 font-normal">({visibleCategories.length})</span>
        </h3>
        {loading
          ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
          : visibleCategories.length === 0
            ? <p className="text-gray-600 text-sm py-4">Bu bölümde henüz kategori yok.</p>
            : (
              <div className="space-y-1.5">
                {visibleCategories.map(cat => (
                  <div key={cat._id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                      ${editingId === cat._id ? "border-brand-500/30 bg-brand-500/5" : "border-white/5 bg-surface-800/40 hover:bg-surface-800"}`}>
                    <span className="text-xl">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold">{cat.name}</p>
                      <p className="text-gray-600 text-xs">{cat.videoCount || 0} video</p>
                    </div>
                    <button onClick={() => startEdit(cat)} className="text-xs text-gray-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-surface-600 transition-colors">Düzenle</button>
                    <button onClick={() => handleSil(cat._id, cat.name)} disabled={deleting === cat._id}
                      className="text-xs text-red-500 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50">
                      {deleting === cat._id ? "..." : "Sil"}
                    </button>
                  </div>
                ))}
              </div>
            )
        }
      </div>
    </div>
  );
}

// ─── Video Edit Modal ─────────────────────────────────────────────
function VideoEditModal({ video, allCategories, onSave, onClose }) {
  const thumbRef = useRef(null);
  const existingTags = video.tags || [];
  const predefinedTagValues = SPECIAL_TAGS.map(s => s.tag);
  const [form, setForm] = useState({
    title: video.title || "",
    description: video.description || "",
    tags: existingTags.filter(t => !predefinedTagValues.includes(t)).join(", "),
    specialTags: existingTags.filter(t => predefinedTagValues.includes(t)),
    categories: video.categories?.map(c => c._id) || (video.category ? [video.category._id] : []),
    thumbFile: null,
    thumbPreview: video.thumbnailUrl,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.title.trim()) { toast.error("Başlık zorunlu"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      const manualTags = (form.tags || "").split(",").map(t => t.trim()).filter(Boolean);
      const allTags = [...new Set([...(form.specialTags || []), ...manualTags])].join(", ");
      fd.append("title", form.title.trim());
      fd.append("description", form.description.trim());
      fd.append("tags", allTags);
      fd.append("categories", JSON.stringify(form.categories || []));
      if (form.thumbFile) fd.append("thumbnail", form.thumbFile);
      await videoApi.update(video._id, fd);
      toast.success("Video güncellendi");
      onSave();
    } catch (err) {
      toast.error("Güncelleme hatası: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="font-display font-bold text-white">Video Düzenle</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-surface-800 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Thumbnail */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Thumbnail</p>
            <div className="flex gap-3 items-start">
              <div className="w-40 aspect-video rounded-lg overflow-hidden bg-surface-800 flex-shrink-0 cursor-pointer relative group" onClick={() => thumbRef.current?.click()}>
                <img src={form.thumbPreview} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-medium">Değiştir</span>
                </div>
              </div>
              <input ref={thumbRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={e => { const f = e.target.files[0]; if (f) setForm(p => ({ ...p, thumbFile: f, thumbPreview: URL.createObjectURL(f) })); }} />
            </div>
          </div>
          {/* Title */}
          <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Başlık *" maxLength={200}
            className="w-full bg-surface-800 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-3 py-2.5 rounded-xl text-sm outline-none" />
          {/* Description */}
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Açıklama" rows={4} maxLength={5000}
            className="w-full bg-surface-800 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-3 py-2.5 rounded-xl text-sm outline-none resize-none" />
          {/* Special sections */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Bölüm</p>
            <SectionDropdown
              value={form.specialTags || []}
              onChange={tags => setForm(p => ({ ...p, specialTags: tags }))}
            />
          </div>
          {/* Categories — filtered by selected sections */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Kategoriler</p>
            <CategoryMultiSelect
              allCategories={allCategories.filter(cat =>
                !cat.section || (form.specialTags || []).includes(cat.section)
              )}
              selected={form.categories}
              onChange={cats => setForm(p => ({ ...p, categories: cats }))}
            />
          </div>
          {/* Tags */}
          <input type="text" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
            placeholder="Etiketler (virgülle ayır)"
            className="w-full bg-surface-800 border border-white/8 focus:border-brand-500 text-white placeholder-gray-600 px-3 py-2.5 rounded-xl text-sm outline-none" />
        </div>
        <div className="flex gap-3 p-5 border-t border-white/8">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 flex-1 justify-center">
            {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button onClick={onClose} className="btn-ghost">İptal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Video List ───────────────────────────────────────────────────
function AdminVideoList({ refresh }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { loadVideos(); }, [refresh]);
  useEffect(() => { categoryApi.getAll().then(r => setAllCategories(r.data)).catch(() => {}); }, []);

  async function loadVideos() {
    setLoading(true);
    try { const res = await videoApi.getAll({ limit: 50 }); setVideos(res.data); }
    catch { toast.error("Videolar yüklenemedi"); }
    finally { setLoading(false); }
  }

  async function handleSil(id, title) {
    if (!window.confirm(`Sil: "${title}"?`)) return;
    setDeleting(id);
    try {
      await videoApi.delete(id);
      setVideos(vs => vs.filter(v => v._id !== id));
      toast.success("Video silindi");
    } catch (err) { toast.error(err.message); }
    finally { setDeleting(null); }
  }

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>;
  if (videos.length === 0) return <p className="text-gray-600 text-center py-12">Henüz video yüklenmedi.</p>;

  return (
    <div className="space-y-2">
      {videos.map(v => {
        const cats = v.categories?.length ? v.categories : (v.category ? [v.category] : []);
        return (
          <div key={v._id} className="flex gap-3 p-3 rounded-xl bg-surface-800/40 hover:bg-surface-800 border border-white/5 transition-colors">
            <div className="w-28 sm:w-36 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-surface-700 cursor-pointer" onClick={() => navigate(`/video/${v.slug || v._id}`)}>
              <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover hover:scale-105 transition-transform" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white text-sm font-semibold line-clamp-1">{v.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 flex-wrap">
                <span>{format(new Date(v.createdAt), "d MMM yyyy", { locale: tr })}</span>
                <span className="text-yellow-500/70">{(v.views || 0).toLocaleString("tr-TR")} gerçek görüntülenme</span>
                {cats.map(cat => cat && (
                  <span key={cat._id} className="text-brand-500/60">{cat.icon} {cat.name}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button onClick={() => navigate(`/video/${v.slug || v._id}`)} className="text-xs text-gray-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-surface-600 transition-colors">Görüntüle</button>
              <button onClick={() => setEditingVideo(v)} className="text-xs text-brand-400 hover:text-brand-300 px-2.5 py-1.5 rounded-lg hover:bg-brand-500/10 transition-colors">Düzenle</button>
              <button onClick={() => handleSil(v._id, v.title)} disabled={deleting === v._id}
                className="text-xs text-red-500 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50">
                {deleting === v._id ? "..." : "Sil"}
              </button>
            </div>
          </div>
        );
      })}
      {editingVideo && (
        <VideoEditModal
          video={editingVideo}
          allCategories={allCategories}
          onSave={() => { setEditingVideo(null); loadVideos(); }}
          onClose={() => setEditingVideo(null)}
        />
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────
const TABS = [
  { key: "upload",     label: "Video Yükle",    icon: "↑" },
  { key: "video",      label: "Videolar",        icon: "☰" },
  { key: "categories", label: "Kategoriler",     icon: "#" },
  { key: "ads",        label: "Reklamlar",       icon: "$" },
];

export default function Admin() {
  const { isAdmin, login, logout } = useAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState("upload");
  const [refreshKey, setRefreshKey] = useState(0);

  if (!isAdmin) return (
    <>
      <SEOHead title="Admin" noIndex={true} />
      <AdminLogin onLogin={login} />
    </>
  );

  return (
    <>
      <SEOHead title="Yönetim Paneli" noIndex={true} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-7 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-white">Yönetim Paneli</h1>
            <p className="text-gray-600 text-sm mt-0.5">İçerikleri yönet</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate("/")} className="btn-ghost text-sm">← Site</button>
            <button onClick={() => { logout(); navigate("/"); }}
              className="text-sm text-red-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors">
              Çıkış
            </button>
          </div>
        </div>

        <div className="flex gap-0.5 bg-surface-900 border border-white/5 rounded-xl p-1 mb-5 overflow-x-auto scrollbar-hide w-full sm:w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap min-h-[40px]
                ${tab === t.key ? "bg-brand-500 text-white" : "text-gray-500 hover:text-white"}`}>
              <span className="font-mono text-xs">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <div className="bg-surface-900 border border-white/5 rounded-2xl p-5 sm:p-6">
          {tab === "upload" && (
            <>
              <h2 className="font-display font-bold text-base text-white mb-5">Video Yükle</h2>
              <MultiUploadQueue onSuccess={() => { setRefreshKey(k => k + 1); }} />
            </>
          )}
          {tab === "video" && (
            <>
              <h2 className="font-display font-bold text-base text-white mb-5">Tüm Videolar</h2>
              <AdminVideoList refresh={refreshKey} />
            </>
          )}
          {tab === "categories" && (
            <>
              <h2 className="font-display font-bold text-base text-white mb-5">Kategoriler</h2>
              <KategoriManager />
            </>
          )}
          {tab === "ads" && (
            <>
              <h2 className="font-display font-bold text-base text-white mb-1">Reklam Yönetimi</h2>
              <p className="text-gray-600 text-sm mb-5">Her slotu aç/kapat ve kod yapıştır.</p>
              <AdsManager />
            </>
          )}
        </div>
      </div>
    </>
  );
}
