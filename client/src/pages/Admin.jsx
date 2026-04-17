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
      toast.success("Hoş geldin, Yönetici! 👋");
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Sunucuya ulaşılamıyor. Port 5000'de çalışıyor mu?" : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-500/10 border border-brand-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-2xl text-white">Yönetici Girişi</h1>
          <p className="text-gray-500 text-sm mt-1">Devam etmek için şifreni gir</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Yönetici şifresi" autoFocus
              className="w-full bg-surface-800 border border-surface-600 focus:border-brand-500 text-white placeholder-gray-600 px-4 py-3 rounded-xl text-sm outline-none transition-colors" />
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
          <button type="submit" disabled={loading || !password}
            className="btn-primary w-full justify-center flex items-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Doğrulanıyor...</> : "Yönetim Paneline Gir"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Upload Form ──────────────────────────────────────────────────
function UploadForm({ onSuccess }) {
  const [form, setForm] = useState({ title: "", description: "", tags: "", category: "" });
  const [videoFile, setVideoFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [thumbPreview, setThumbPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [categories, setCategories] = useState([]);
  const videoInputRef = useRef(null);
  const thumbInputRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    categoryApi.getAll().then(res => setCategories(res.data)).catch(() => {});
    return () => clearInterval(pollRef.current);
  }, []);

  function handleThumbChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !videoFile || !thumbFile) {
      toast.error("Başlık, video ve thumbnail zorunlu"); return;
    }
    if (videoFile.size > 1024 * 1024 * 1024) {
      toast.error("Video maksimum 1GB olabilir"); return;
    }
    setUploading(true); setProgress(0);
    const fd = new FormData();
    fd.append("title", form.title.trim());
    fd.append("description", form.description.trim());
    fd.append("tags", form.tags.trim());
    if (form.category) fd.append("category", form.category);
    fd.append("video", videoFile);
    fd.append("thumbnail", thumbFile);
    try {
      toast.loading("Video sunucuya yükleniyor...", { id: "upload" });
      const res = await videoApi.upload(fd, setProgress);
      const videoId = res.data._id;

      setUploading(false);
      setProcessing(true);
      toast.loading("HLS dönüştürülüyor, lütfen bekleyin...", { id: "upload" });

      // Poll until status = ready or error
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await videoApi.getById(videoId);
          const status = statusRes.data?.status;
          if (status === "ready") {
            clearInterval(pollRef.current);
            setProcessing(false);
            toast.success("Video hazır! Stream URL oluşturuldu.", { id: "upload" });
            setForm({ title: "", description: "", tags: "", category: "" });
            setVideoFile(null); setThumbFile(null); setThumbPreview(null); setProgress(0);
            if (videoInputRef.current) videoInputRef.current.value = "";
            if (thumbInputRef.current) thumbInputRef.current.value = "";
            onSuccess?.();
          } else if (status === "error") {
            clearInterval(pollRef.current);
            setProcessing(false);
            toast.error("HLS dönüştürme başarısız oldu.", { id: "upload" });
          }
        } catch {}
      }, 4000);
    } catch (err) {
      setUploading(false);
      toast.error("Yükleme hatası: " + err.message, { id: "upload" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-display font-medium text-gray-300 mb-1.5">Başlık <span className="text-brand-500">*</span></label>
        <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          placeholder="Video başlığını gir..." maxLength={200} required
          className="w-full bg-surface-800 border border-surface-600 focus:border-brand-500 text-white placeholder-gray-600 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors" />
      </div>

      {/* SEO Açıklama */}
      <div>
        <label className="block text-sm font-display font-medium text-gray-300 mb-1.5">
          Açıklama
          <span className="text-gray-500 font-normal ml-2 text-xs">SEO meta etiketleri için kullanılır</span>
        </label>
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          placeholder="Videoyu açıkla (arama sonuçlarında görünür)..."
          rows={4} maxLength={5000}
          className="w-full bg-surface-800 border border-surface-600 focus:border-brand-500 text-white placeholder-gray-600 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors resize-none" />
        <p className="text-gray-600 text-xs mt-1">{form.description.length}/5000 · İlk 160 karakter Google arama sonuçlarında görünür</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-display font-medium text-gray-300 mb-1.5">Kategori</label>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full bg-surface-800 border border-surface-600 focus:border-brand-500 text-white px-4 py-2.5 rounded-xl text-sm outline-none transition-colors">
            <option value="">— Kategori seçme —</option>
            {categories.map(cat => (
              <option key={cat._id} value={cat._id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-display font-medium text-gray-300 mb-1.5">Etiketler <span className="text-gray-600 font-normal">(virgülle ayır)</span></label>
          <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
            placeholder="oyun, vlog, inceleme..."
            className="w-full bg-surface-800 border border-surface-600 focus:border-brand-500 text-white placeholder-gray-600 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-display font-medium text-gray-300 mb-1.5">Thumbnail <span className="text-brand-500">*</span></label>
          <div onClick={() => thumbInputRef.current?.click()}
            className="relative cursor-pointer border-2 border-dashed border-surface-600 hover:border-brand-500/50 rounded-xl transition-colors overflow-hidden aspect-video flex items-center justify-center bg-surface-800">
            {thumbPreview
              ? <img src={thumbPreview} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
              : <div className="flex flex-col items-center gap-2 p-4">
                  <svg className="w-8 h-8 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  <span className="text-xs text-gray-500">Kapak fotoğrafı yükle</span>
                  <span className="text-xs text-gray-700">JPG, PNG, WebP</span>
                </div>
            }
            <input ref={thumbInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleThumbChange} className="hidden" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-display font-medium text-gray-300 mb-1.5">Video File <span className="text-brand-500">*</span></label>
          <div onClick={() => videoInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-surface-600 hover:border-brand-500/50 rounded-xl transition-colors aspect-video flex items-center justify-center bg-surface-800">
            <div className="flex flex-col items-center gap-2 p-4">
              {videoFile
                ? <>
                    <svg className="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs text-brand-400 font-medium truncate max-w-full px-2">{videoFile.name}</span>
                    <span className="text-xs text-gray-600">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</span>
                  </>
                : <>
                    <svg className="w-8 h-8 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-xs text-gray-500">Video seç</span>
                    <span className="text-xs text-gray-700">MP4, MOV, AVI, MKV, WebM</span>
                  </>
              }
            </div>
            <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/avi,video/x-matroska,video/webm"
              onChange={e => setVideoFile(e.target.files[0])} className="hidden" />
          </div>
        </div>
      </div>

      {uploading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Cloudinary'ye yükleniyor...</span>
            <span className="font-mono text-brand-400">{progress}%</span>
          </div>
          <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {processing && (
        <div className="flex items-center gap-3 p-4 bg-brand-500/10 border border-brand-500/30 rounded-xl">
          <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-400 rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-brand-400">HLS dönüştürülüyor...</p>
            <p className="text-xs text-gray-500 mt-0.5">Video işleniyor, bu birkaç dakika sürebilir</p>
          </div>
        </div>
      )}

      <button type="submit" disabled={uploading || processing || !form.title || !videoFile || !thumbFile}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        {uploading
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Yükleniyor... {progress}%</>
          : processing
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />İşleniyor...</>
          : <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Video Yükle
            </>
        }
      </button>
    </form>
  );
}

// ─── Ads Manager ─────────────────────────────────────────────────
const AD_SLOT_DEFS = [
  {
    key: "topBanner",
    icon: "📰",
    label: "Üst Banner",
    desc: "Ana sayfanın üstünde gösterilir",
    presets: {
      desktop: [["728","90"],["970","90"],["970","250"]],
      mobile:  [["320","50"],["320","100"],["300","50"]],
    },
  },
  {
    key: "sidebar",
    icon: "📐",
    label: "Kenar Çubuğu",
    desc: "Video sayfasında sağ sütunda sabit durur",
    presets: {
      desktop: [["300","250"],["300","600"],["160","600"]],
      mobile:  [["300","250"],["320","100"]],
    },
  },
  {
    key: "inFeed",
    icon: "🔲",
    label: "Feed İçi (Native)",
    desc: "Ana sayfada video kartları arasında çıkar",
    presets: {
      desktop: [["336","280"],["300","250"],["728","90"]],
      mobile:  [["300","250"],["320","100"]],
    },
  },
  {
    key: "stickyBanner",
    icon: "📌",
    label: "Yapışkan Banner",
    desc: "Sayfanın altına sabitlenir, kullanıcı kapatabilir",
    presets: {
      desktop: [["728","90"],["970","90"]],
      mobile:  [["320","50"],["320","100"]],
    },
  },
  {
    key: "popunder",
    icon: "🔗",
    label: "Popunder",
    desc: "İlk tıklamada arka planda yeni sekme açar (script kodu yeter)",
    presets: { desktop: [], mobile: [] },
    noSize: true,
  },
  {
    key: "instreamVideo",
    icon: "▶️",
    label: "Video Öncesi (Instream)",
    desc: "Video oynatılmadan önce gösterilir, 5 saniye sonra geçilebilir",
    presets: {
      desktop: [["100%","480"],["100%","360"]],
      mobile:  [["100%","240"],["100%","180"]],
    },
  },
  {
    key: "instantMessage",
    icon: "💬",
    label: "Anlık Mesaj (Interstitial)",
    desc: "Sayfa yüklendikten 2 saniye sonra tam ekran overlay olarak çıkar",
    presets: {
      desktop: [["800","600"],["640","480"]],
      mobile:  [["320","480"],["300","250"]],
    },
  },
];

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none
        ${value ? "bg-brand-500" : "bg-surface-600"}`}
    >
      <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform duration-200
        ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function DevicePanel({ slotDef, device, data, onChange }) {
  const presets = slotDef.presets[device] || [];

  function set(field, val) {
    onChange({ ...data, [field]: val });
  }

  const isPresetActive = (w, h) => data.width === w && data.height === h;

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium">
          {device === "desktop" ? "🖥 Masaüstü" : "📱 Mobil"}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${data.enabled ? "text-green-400" : "text-gray-600"}`}>
            {data.enabled ? "Açık" : "Kapalı"}
          </span>
          <Toggle value={data.enabled} onChange={v => set("enabled", v)} />
        </div>
      </div>

      {/* Size Presets */}
      {!slotDef.noSize && (
        <div>
          <p className="text-[10px] text-gray-600 mb-1.5 uppercase tracking-wider">Boyut Presetleri</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {presets.map(([w, h]) => (
              <button
                key={`${w}x${h}`}
                type="button"
                onClick={() => onChange({ ...data, width: w, height: h })}
                className={`text-[10px] font-mono px-2 py-1 rounded transition-colors
                  ${isPresetActive(w, h)
                    ? "bg-brand-500 text-white"
                    : "bg-surface-700 text-gray-400 hover:bg-surface-600"}`}
              >
                {w}×{h}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <input
                type="text"
                value={data.width || ""}
                onChange={e => set("width", e.target.value)}
                placeholder="Genişlik (px veya %)"
                className="w-full bg-surface-700 border border-surface-600 focus:border-brand-500 text-white placeholder-gray-600 px-2.5 py-1.5 rounded-lg text-xs outline-none"
              />
            </div>
            <span className="text-gray-600 text-xs">×</span>
            <div className="flex-1">
              <input
                type="text"
                value={data.height || ""}
                onChange={e => set("height", e.target.value)}
                placeholder="Yükseklik (px)"
                className="w-full bg-surface-700 border border-surface-600 focus:border-brand-500 text-white placeholder-gray-600 px-2.5 py-1.5 rounded-lg text-xs outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Code */}
      <div>
        <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-wider">Reklam Kodu</p>
        <textarea
          value={data.code || ""}
          onChange={e => set("code", e.target.value)}
          placeholder={`<!-- ${slotDef.label} ${device === "mobile" ? "mobil" : "masaüstü"} kodu -->`}
          rows={4}
          className="w-full bg-surface-700 border border-surface-600 focus:border-brand-500 text-white placeholder-gray-600 px-2.5 py-2 rounded-lg text-xs font-mono outline-none resize-y"
        />
      </div>
    </div>
  );
}

function AdsManager() {
  const { ads, setAds } = useAds();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeSlot, setActiveSlot] = useState("topBanner");

  useEffect(() => {
    if (ads) setForm(JSON.parse(JSON.stringify(ads)));
  }, [ads]);

  if (!form) return <div className="skeleton h-40 rounded-xl" />;

  function updateDevice(slotKey, device, data) {
    setForm(prev => ({
      ...prev,
      [slotKey]: { ...prev[slotKey], [device]: data },
    }));
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
      {/* Slot Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
        {AD_SLOT_DEFS.map(slot => (
          <button
            key={slot.key}
            type="button"
            onClick={() => setActiveSlot(slot.key)}
            className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-center transition-all relative
              ${activeSlot === slot.key
                ? "bg-brand-500 text-white shadow"
                : "bg-surface-800 text-gray-400 hover:text-white hover:bg-surface-700"}`}
          >
            <span className="text-lg leading-none">{slot.icon}</span>
            <span className="text-[10px] font-display font-medium leading-tight">{slot.label}</span>
            {isAnyEnabled(slot.key) && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-green-400" />
            )}
          </button>
        ))}
      </div>

      {/* Active Slot Config */}
      {activeDef && (
        <div className="bg-surface-800/60 rounded-2xl p-5 border border-surface-700/50 space-y-5">
          <div>
            <h3 className="font-display font-semibold text-white flex items-center gap-2">
              <span>{activeDef.icon}</span> {activeDef.label}
            </h3>
            <p className="text-gray-500 text-xs mt-0.5">{activeDef.desc}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-surface-900/50 rounded-xl p-4 border border-surface-700/30">
              <DevicePanel
                slotDef={activeDef}
                device="desktop"
                data={activeData.desktop || {}}
                onChange={data => updateDevice(activeSlot, "desktop", data)}
              />
            </div>
            <div className="bg-surface-900/50 rounded-xl p-4 border border-surface-700/30">
              <DevicePanel
                slotDef={activeDef}
                device="mobile"
                data={activeData.mobile || {}}
                onChange={data => updateDevice(activeSlot, "mobile", data)}
              />
            </div>
          </div>
        </div>
      )}

      <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
        {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
      </button>
    </form>
  );
}

// ─── Kategori Manager ─────────────────────────────────────────────
function KategoriManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", icon: "🎬", description: "", color: "#ff6b00" });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const PRESET_ICONS = ["🎬", "🎮", "🎵", "📚", "🏆", "🍕", "✈️", "💡", "🎨", "🔬", "💪", "😂", "🌍", "🐾", "👗", "🏠"];

  useEffect(() => { loadCategories(); }, []);

  async function loadCategories() {
    setLoading(true);
    try { const res = await categoryApi.getAll(); setCategories(res.data); }
    catch (err) { toast.error("Kategoriler yüklenemedi"); }
    finally { setLoading(false); }
  }

  function startEdit(cat) {
    setEditingId(cat._id);
    setForm({ name: cat.name, icon: cat.icon, description: cat.description || "", color: cat.color || "#ff6b00" });
  }

  function cancelEdit() { setEditingId(null); setForm({ name: "", icon: "🎬", description: "", color: "#ff6b00" }); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("İsim zorunlu"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const res = await categoryApi.update(editingId, form);
        setCategories(cats => cats.map(c => c._id === editingId ? res.data : c));
        toast.success("Kategori güncellendi");
      } else {
        const res = await categoryApi.create(form);
        setCategories(cats => [...cats, res.data]);
        toast.success("Kategori oluşturuldu");
      }
      cancelEdit();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSil(id, name) {
    if (!window.confirm(`"${name}" kategorisini sil? Bu kategorideki videolar kategorisiz kalır.`)) return;
    setDeleting(id);
    try {
      await categoryApi.delete(id);
      setCategories(cats => cats.filter(c => c._id !== id));
      toast.success("Kategori silindi");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-surface-800/60 rounded-2xl p-5 border border-surface-700/50">
        <h3 className="font-display font-semibold text-white mb-4">
          {editingId ? "✏️ Kategori Düzenle" : "➕ Yeni Kategori"}
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">İsim *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="örn. Oyun, Müzik..." maxLength={50}
                className="w-full bg-surface-700 border border-surface-600 focus:border-brand-500 text-white placeholder-gray-600 px-3 py-2 rounded-lg text-sm outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Açıklama</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Opsiyonel açıklama..." maxLength={200}
                className="w-full bg-surface-700 border border-surface-600 focus:border-brand-500 text-white placeholder-gray-600 px-3 py-2 rounded-lg text-sm outline-none transition-colors" />
            </div>
          </div>

          {/* İkon picker */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">İkon</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ICONS.map(emoji => (
                <button key={emoji} type="button" onClick={() => setForm({ ...form, icon: emoji })}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all
                    ${form.icon === emoji ? "bg-brand-500/20 border-2 border-brand-500" : "bg-surface-700 hover:bg-surface-600 border-2 border-transparent"}`}>
                  {emoji}
                </button>
              ))}
              <input type="text" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
                maxLength={2} placeholder="✨"
                className="w-9 h-9 bg-surface-700 border-2 border-surface-600 focus:border-brand-500 text-center text-lg rounded-lg outline-none" />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="btn-primary flex items-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {editingId ? "Kaydet" : "Kategori Oluştur"}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="btn-ghost">İptal</button>
            )}
          </div>
        </form>
      </div>

      {/* Kategori list */}
      <div>
        <h3 className="font-display font-semibold text-white mb-3">Tüm Kategoriler</h3>
        {loading
          ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
          : categories.length === 0
            ? <p className="text-gray-600 text-sm py-4">Henüz kategori yok. Yukarıdan oluştur.</p>
            : (
              <div className="space-y-2">
                {categories.map(cat => (
                  <div key={cat._id}
                    className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all
                      ${editingId === cat._id ? "border-brand-500/40 bg-brand-500/5" : "border-surface-700/50 bg-surface-800/40 hover:bg-surface-800"}`}>
                    <span className="text-2xl">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-display font-semibold">{cat.name}</p>
                      {cat.description && <p className="text-gray-500 text-xs truncate">{cat.description}</p>}
                      <p className="text-gray-600 text-xs mt-0.5">{cat.videoCount || 0} video</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(cat)}
                        className="text-xs text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-surface-600 transition-colors">
                        Düzenle
                      </button>
                      <button onClick={() => handleSil(cat._id, cat.name)} disabled={deleting === cat._id}
                        className="text-xs text-red-500 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50">
                        {deleting === cat._id ? "..." : "Sil"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
        }
      </div>
    </div>
  );
}

// ─── Video List ───────────────────────────────────────────────────
function AdminVideoList({ refresh }) {
  const [video, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadVideos(); }, [refresh]);

  async function loadVideos() {
    setLoading(true);
    try { const res = await videoApi.getAll({ limit: 50 }); setVideos(res.data); }
    catch { toast.error("Videolar yüklenemedi"); }
    finally { setLoading(false); }
  }

  async function handleSil(id, title) {
    if (!window.confirm(`Sil "${title}"?`)) return;
    setDeleting(id);
    try {
      await videoApi.delete(id);
      setVideos(vs => vs.filter(v => v._id !== id));
      toast.success("Video silindi");
    } catch (err) { toast.error(err.message); }
    finally { setDeleting(null); }
  }

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>;
  if (video.length === 0) return <p className="text-gray-600 text-center py-12">Henüz video yüklenmedi.</p>;

  return (
    <div className="space-y-2">
      {video.map(v => (
        <div key={v._id} className="flex gap-3 p-3 rounded-xl bg-surface-800 hover:bg-surface-700/70 border border-surface-700/50 transition-colors">
          <div className="w-28 sm:w-36 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-surface-700 cursor-pointer" onClick={() => navigate(`/video/${v._id}`)}>
            <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover hover:scale-105 transition-transform" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white text-sm font-display font-semibold line-clamp-1">{v.title}</h3>
            {v.description && <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{v.description}</p>}
            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-600 flex-wrap">
              <span>{v.izlenme} izlenme</span>
              <span>·</span>
              <span>{format(new Date(v.createdAt), "d MMM yyyy", { locale: tr })}</span>
              {v.category && <span className="text-brand-500/70">{v.category.icon} {v.category.name}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button onClick={() => navigate(`/video/${v._id}`)} className="text-xs text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-surface-600 transition-colors">Görüntüle</button>
            <button onClick={() => handleSil(v._id, v.title)} disabled={deleting === v._id}
              className="text-xs text-red-500 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50">
              {deleting === v._id ? "..." : "Sil"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────
const TABS = [
  { key: "upload", label: "Video Yükle", icon: "↑" },
  { key: "video", label: "Videoları Yönet", icon: "☰" },
  { key: "categories", label: "Kategoriler", icon: "🏷️" },
  { key: "ads", label: "Reklamlar", icon: "📢" },
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
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="font-display font-bold text-2xl text-white">Yönetim Paneli</h1>
            <p className="text-gray-500 text-sm mt-0.5">Video içeriklerini yönet</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate("/")} className="btn-ghost text-sm">← Siteye Dön</button>
            <button onClick={() => { logout(); navigate("/"); }}
              className="text-sm text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors">
              Çıkış
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-800 rounded-xl p-1 mb-6 overflow-x-auto scrollbar-hide w-full sm:w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-display font-medium transition-all duration-200 touch-manipulation whitespace-nowrap min-h-[44px]
                ${tab === t.key ? "bg-brand-500 text-white shadow" : "text-gray-400 hover:text-white"}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <div className="bg-surface-900 border border-surface-700/50 rounded-2xl p-5 sm:p-7">
          {tab === "upload" && (
            <>
              <h2 className="font-display font-bold text-lg text-white mb-5">Yeni Video Yükle</h2>
              <UploadForm onSuccess={() => { setRefreshKey(k => k + 1); setTimeout(() => setTab("video"), 1200); }} />
            </>
          )}
          {tab === "video" && (
            <>
              <h2 className="font-display font-bold text-lg text-white mb-5">Tüm Videolar</h2>
              <AdminVideoList refresh={refreshKey} />
            </>
          )}
          {tab === "categories" && (
            <>
              <h2 className="font-display font-bold text-lg text-white mb-5">Kategorileri Yönet</h2>
              <KategoriManager />
            </>
          )}
          {tab === "ads" && (
            <>
              <h2 className="font-display font-bold text-lg text-white mb-1">Reklam Yönetimi</h2>
              <p className="text-gray-500 text-sm mb-6">Her reklam slotunu aç/kapat ve kod yapıştır. Değişiklikler anında sitede görünür.</p>
              <AdsManager />
            </>
          )}
        </div>
      </div>
    </>
  );
}
