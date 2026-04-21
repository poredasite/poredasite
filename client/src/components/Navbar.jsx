import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAdmin } from "../context/AdminContext";
import {
  HiHome, HiFire, HiUser, HiChevronDown,
  HiMenu, HiX, HiCog, HiSearch,
} from "react-icons/hi";

const SPECIAL_LINKS = [
  { label: "Türk Videoları",    href: "/tag/türk" },
  { label: "Türkçe Altyazılı", href: "/tag/türkçe-altyazılı" },
  { label: "Türk İfşa",        href: "/tag/türk-ifşa" },
];

function SearchBar({ className = "" }) {
  const navigate   = useNavigate();
  const [q, setQ]  = useState("");
  const inputRef   = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    setQ("");
    inputRef.current?.blur();
  }

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Video ara..."
        className="w-full bg-surface-800 border border-white/6 hover:border-white/12 focus:border-brand-500/60 text-white placeholder-neutral-600 pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition-colors"
      />
    </form>
  );
}

export default function Navbar() {
  const { isAdmin, logout } = useAdmin();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [searchParams] = useSearchParams();
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => { setMenuOpen(false); setProfileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  const isActive = (path, sort) => {
    if (sort) return location.pathname === path && searchParams.get("sort") === sort;
    return location.pathname === path && !searchParams.get("sort");
  };

  const navLinkCls = (active) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
      active
        ? "text-white bg-white/8"
        : "text-neutral-500 hover:text-white hover:bg-white/5"
    }`;

  return (
    <header className="sticky top-0 z-50 bg-surface-950/98 backdrop-blur-xl border-b border-white/[0.06]">

      {/* ── Desktop nav ─────────────────────────────────────────── */}
      <nav className="max-w-[1600px] mx-auto px-4 h-[4.25rem] hidden md:flex items-center gap-2">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group mr-4 flex-shrink-0" aria-label="Ana Sayfa">
          <span className="text-2xl select-none transition-transform duration-200 group-hover:scale-110">😎</span>
          <span className="font-display font-bold text-[1.15rem] text-white tracking-tight leading-none">
            xxxpor<span className="text-brand-500">eda</span>
          </span>
        </Link>

        {/* Primary links */}
        <div className="flex items-center gap-0.5">
          <Link to="/" className={navLinkCls(isActive("/"))}>
            <HiHome className="w-4 h-4" />Ana Sayfa
          </Link>
          <Link to="/?sort=views" className={navLinkCls(isActive("/", "views"))}>
            <HiFire className="w-4 h-4" />Popüler
          </Link>

          <div className="w-px h-4 bg-white/8 mx-1.5" />

          {SPECIAL_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              to={href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                location.pathname === href
                  ? "text-brand-400 bg-brand-500/10"
                  : "text-neutral-500 hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Search */}
        <SearchBar className="flex-1 max-w-xs ml-auto" />

        {/* Admin dropdown */}
        {isAdmin && (
          <div className="relative flex-shrink-0 ml-1" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-neutral-500 hover:text-white hover:bg-white/5 transition-all duration-150"
            >
              <HiUser className="w-4 h-4" />
              <span>Admin</span>
              <HiChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-surface-800 border border-white/8 rounded-xl shadow-2xl shadow-black/70 py-1.5 animate-fade-in">
                <div className="px-4 py-2.5 border-b border-white/5 mb-1">
                  <p className="text-[11px] text-brand-500 font-semibold uppercase tracking-wider">Yönetici</p>
                </div>
                <Link to="/admin-baba" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-white/5 transition-colors">
                  <HiCog className="w-4 h-4 text-brand-400" /> Yönetim Paneli
                </Link>
                <div className="border-t border-white/5 my-1" />
                <button onClick={() => { logout(); navigate("/"); setProfileOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-500 hover:text-white hover:bg-white/5 transition-colors">
                  <HiX className="w-4 h-4" /> Çıkış Yap
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ── Mobile top bar ──────────────────────────────────────── */}
      <nav className="md:hidden max-w-[1600px] mx-auto px-3 h-14 flex items-center gap-2.5">
        <Link to="/" className="flex items-center gap-1.5 flex-shrink-0" aria-label="Ana Sayfa">
          <span className="text-xl select-none">😎</span>
          <span className="font-display font-bold text-base text-white tracking-tight leading-none">
            xxxpor<span className="text-brand-500">eda</span>
          </span>
        </Link>

        <SearchBar className="flex-1" />

        <button
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
        >
          {menuOpen ? <HiX className="w-5 h-5" /> : <HiMenu className="w-5 h-5" />}
        </button>
      </nav>

      {/* ── Mobile dropdown ─────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-surface-900 px-3 py-2 space-y-0.5 animate-slide-up">
          <Link to="/"
            className="flex items-center gap-3 text-neutral-400 py-2.5 px-3 rounded-xl text-sm hover:bg-white/5 hover:text-white transition-colors">
            <HiHome className="w-4 h-4" /> Ana Sayfa
          </Link>
          <Link to="/?sort=views"
            className="flex items-center gap-3 text-neutral-400 py-2.5 px-3 rounded-xl text-sm hover:bg-white/5 hover:text-white transition-colors">
            <HiFire className="w-4 h-4" /> Popüler
          </Link>

          <div className="border-t border-white/[0.06] my-1.5" />

          {SPECIAL_LINKS.map(({ label, href }) => (
            <Link key={href} to={href}
              className="flex items-center gap-3 text-brand-400/80 py-2.5 px-3 rounded-xl text-sm hover:bg-white/5 hover:text-white transition-colors font-medium">
              <span className="text-base">🇹🇷</span> {label}
            </Link>
          ))}

          {isAdmin && (
            <>
              <div className="border-t border-white/[0.06] my-1.5" />
              <Link to="/admin-baba"
                className="flex items-center gap-3 text-brand-400 py-2.5 px-3 rounded-xl text-sm hover:bg-white/5 transition-colors">
                <HiCog className="w-4 h-4" /> Yönetim Paneli
              </Link>
              <button onClick={() => { logout(); navigate("/"); }}
                className="flex w-full items-center gap-3 text-neutral-600 py-2.5 px-3 rounded-xl text-sm hover:bg-white/5 transition-colors">
                <HiX className="w-4 h-4" /> Çıkış Yap
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
