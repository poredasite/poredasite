import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAdmin } from "../context/AdminContext";
import {
  HiHome, HiTrendingUp, HiViewGrid, HiHeart, HiChatAlt,
  HiUser, HiChevronDown, HiMenu, HiX, HiCog
} from "react-icons/hi";

// ─── Nav config ───────────────────────────────────────────────────────────────
// enabled: false → item gizlenir, sil gerekmez
const NAV_ITEMS = [
  { key: "home",       label: "Ana Sayfa",  path: "/",  icon: HiHome,       enabled: true  },
  { key: "trending",   label: "Trending",   path: "/",  icon: HiTrendingUp, enabled: true  },
  { key: "categories", label: "Kategoriler",path: "/",  icon: HiViewGrid,   enabled: true  },
  { key: "favorites",  label: "Favoriler",  path: null, icon: HiHeart,      enabled: false },
  { key: "messages",   label: "Mesajlar",   path: null, icon: HiChatAlt,    enabled: false },
];

export default function Navbar() {
  const { isAdmin, logout } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen]       = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  const isActive = (path) => {
    if (!path) return false;
    const base = path.split("?")[0].split("#")[0];
    return base === "/" ? location.pathname === "/" : location.pathname.startsWith(base);
  };

  const enabledItems = NAV_ITEMS.filter((i) => i.enabled);

  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/5">
      {/* ── Desktop ─────────────────────────────────────────────────────── */}
      <nav className="max-w-[1600px] mx-auto px-6 h-[4.5rem] hidden md:flex items-center">

        {/* Left — Logo */}
        <div className="flex-1 flex items-center">
          <Link to="/" className="flex items-center gap-3 group" aria-label="Ana Sayfa">
            <span className="text-3xl select-none transition-transform duration-200 group-hover:scale-110" role="img">😎</span>
            <span className="font-display font-bold text-xl text-white tracking-tight">
              xxxpor<span className="text-brand-500">eda</span>
            </span>
          </Link>
        </div>

        {/* Center — Nav items */}
        <div className="flex items-center gap-1">
          {enabledItems.map(({ key, label, path, icon: Icon }) => (
            <Link
              key={key}
              to={path}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive(path)
                  ? "text-white bg-surface-700"
                  : "text-gray-400 hover:text-white hover:bg-surface-800"}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </div>

        {/* Right — Profile dropdown */}
        <div className="flex-1 flex items-center justify-end">
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-surface-800 transition-all duration-200"
            >
              <HiUser className="w-4 h-4" />
              <span>{isAdmin ? "Admin" : "Profil"}</span>
              <HiChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-surface-800 border border-white/10 rounded-xl shadow-2xl shadow-black/60 py-1.5 animate-fade-in">
                {isAdmin ? (
                  <>
                    <div className="px-4 py-2 border-b border-white/5 mb-1">
                      <p className="text-xs text-brand-400 font-semibold">Yönetici</p>
                    </div>
                    <Link to="/admin" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-700 transition-colors">
                      <HiCog className="w-4 h-4 text-brand-400" /> Yönetim Paneli
                    </Link>
                    <div className="border-t border-white/5 my-1" />
                    <button onClick={() => { logout(); navigate("/"); setProfileOpen(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-surface-700 transition-colors">
                      <HiX className="w-4 h-4" /> Çıkış Yap
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-3 text-xs text-gray-600 text-center">Giriş yapılmadı</div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Mobile ──────────────────────────────────────────────────────── */}
      <nav className="md:hidden max-w-[1600px] mx-auto px-4 h-14 flex items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-1" aria-label="Ana Sayfa">
          <span className="text-2xl select-none">😎</span>
          <span className="font-display font-bold text-lg text-white tracking-tight">
            xxxpor<span className="text-brand-500">eda</span>
          </span>
        </Link>

        {/* Hamburger */}
        <button
          className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-surface-800 transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menü"
        >
          {menuOpen ? <HiX className="w-5 h-5" /> : <HiMenu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/5 bg-surface-900 px-3 py-3 space-y-0.5 animate-slide-up">
          {enabledItems.map(({ key, label, path, icon: Icon }) => (
            <Link key={key} to={path} onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm transition-colors
                ${isActive(path) ? "text-white bg-surface-700" : "text-gray-400 hover:text-white hover:bg-surface-800"}`}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
          {isAdmin && (
            <div className="border-t border-white/5 pt-2 mt-2 space-y-0.5">
              <Link to="/admin" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 text-brand-400 py-2.5 px-3 rounded-xl text-sm hover:bg-surface-800 transition-colors">
                <HiCog className="w-4 h-4" /> Yönetim Paneli
              </Link>
              <button onClick={() => { logout(); navigate("/"); setMenuOpen(false); }}
                className="flex w-full items-center gap-3 text-gray-500 py-2.5 px-3 rounded-xl text-sm hover:bg-surface-800 transition-colors">
                <HiX className="w-4 h-4" /> Çıkış Yap
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
