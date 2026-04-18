import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAdmin } from "../context/AdminContext";
import {
  HiHome, HiTrendingUp, HiViewGrid, HiHeart, HiChatAlt,
  HiUser, HiChevronDown, HiMenu, HiX, HiCog
} from "react-icons/hi";

// ─── Nav config ───────────────────────────────────────────────────────────────
// Set enabled: false to hide an item without deleting it
const NAV_ITEMS = [
  { key: "home",       label: "Ana Sayfa",  path: "/",          icon: HiHome,       enabled: true  },
  { key: "trending",   label: "Trending",   path: "/?sort=views", icon: HiTrendingUp, enabled: true  },
  { key: "categories", label: "Kategoriler",path: "/",          icon: HiViewGrid,   enabled: true  },
  { key: "favorites",  label: "Favoriler",  path: null,         icon: HiHeart,      enabled: false },
  { key: "messages",   label: "Mesajlar",   path: null,         icon: HiChatAlt,    enabled: false },
];

export default function Navbar() {
  const { isAdmin, logout } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown on outside click
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

  const enabledItems = NAV_ITEMS.filter((item) => item.enabled);

  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/5">
      <nav className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group" aria-label="Ana Sayfa">
          <span className="text-2xl select-none transition-transform duration-200 group-hover:scale-110" role="img" aria-label="logo">😎</span>
          <span className="font-display font-bold text-lg sm:text-xl text-white tracking-tight">
            xxxpor<span className="text-brand-500">eda</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5 ml-6">
          {enabledItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.key}
                to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${active
                    ? "text-white bg-surface-700"
                    : "text-gray-400 hover:text-white hover:bg-surface-800"}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">

          {/* Profile / Admin dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-surface-800 transition-all duration-200"
              aria-label="Profil menüsü"
            >
              <HiUser className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:block">{isAdmin ? "Admin" : "Profil"}</span>
              <HiChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
              />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-surface-800 border border-white/10 rounded-xl shadow-2xl shadow-black/60 py-1.5 animate-fade-in">
                {isAdmin ? (
                  <>
                    <div className="px-4 py-2 border-b border-white/5 mb-1">
                      <p className="text-xs text-brand-400 font-medium">Yönetici</p>
                    </div>
                    <Link
                      to="/admin"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-700 transition-colors"
                    >
                      <HiCog className="w-4 h-4 text-brand-400" />
                      Yönetim Paneli
                    </Link>
                    <div className="border-t border-white/5 my-1" />
                    <button
                      onClick={() => { logout(); navigate("/"); setProfileOpen(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-surface-700 transition-colors"
                    >
                      <HiX className="w-4 h-4" />
                      Çıkış Yap
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-3 text-xs text-gray-600 text-center">
                    Giriş yapılmadı
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-500 hover:text-white hover:bg-surface-800 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menüyü aç/kapat"
          >
            {menuOpen ? <HiX className="w-5 h-5" /> : <HiMenu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/5 bg-surface-900 px-3 py-3 space-y-0.5 animate-slide-up">
          {enabledItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.key}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm transition-colors
                  ${active
                    ? "text-white bg-surface-700"
                    : "text-gray-400 hover:text-white hover:bg-surface-800"}`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <div className="border-t border-white/5 pt-2 mt-2 space-y-0.5">
              <Link
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 text-brand-400 py-2.5 px-3 rounded-xl text-sm hover:bg-surface-800 transition-colors"
              >
                <HiCog className="w-4 h-4" />
                Yönetim Paneli
              </Link>
              <button
                onClick={() => { logout(); navigate("/"); setMenuOpen(false); }}
                className="flex w-full items-center gap-3 text-gray-500 py-2.5 px-3 rounded-xl text-sm hover:bg-surface-800 transition-colors"
              >
                <HiX className="w-4 h-4" />
                Çıkış Yap
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
