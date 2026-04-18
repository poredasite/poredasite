import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAdmin } from "../context/AdminContext";
import {
  HiHome, HiFire, HiViewGrid,
  HiUser, HiChevronDown, HiMenu, HiX, HiCog
} from "react-icons/hi";

export default function Navbar() {
  const { isAdmin, logout } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); setProfileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  return (
    <>
      {/* ── Top Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/5">

        {/* Desktop nav */}
        <nav className="max-w-[1600px] mx-auto px-6 h-[4.5rem] hidden md:flex items-center gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group mr-6" aria-label="Ana Sayfa">
            <span className="text-3xl select-none transition-transform duration-200 group-hover:scale-110">😎</span>
            <span className="font-display font-bold text-xl text-white tracking-tight">
              xxxpor<span className="text-brand-500">eda</span>
            </span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1 flex-1">
            <Link to="/"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/" && !searchParams.get("sort")
                  ? "text-white bg-surface-700"
                  : "text-gray-400 hover:text-white hover:bg-surface-800"
              }`}>
              <HiHome className="w-4 h-4" /> Ana Sayfa
            </Link>
            <Link to="/?sort=views"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                searchParams.get("sort") === "views"
                  ? "text-white bg-surface-700"
                  : "text-gray-400 hover:text-white hover:bg-surface-800"
              }`}>
              <HiFire className="w-4 h-4" /> Popüler
            </Link>
          </div>

          {/* Profile dropdown */}
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
                  <Link to="/admin" onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-surface-700 transition-colors">
                    <HiCog className="w-4 h-4" /> Giriş Yap
                  </Link>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Mobile top bar */}
        <nav className="md:hidden max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" aria-label="Ana Sayfa">
            <span className="text-2xl select-none">😎</span>
            <span className="font-display font-bold text-lg text-white tracking-tight">
              xxxpor<span className="text-brand-500">eda</span>
            </span>
          </Link>

          <button
            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-surface-800 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
          >
            {menuOpen ? <HiX className="w-5 h-5" /> : <HiMenu className="w-5 h-5" />}
          </button>
        </nav>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/5 bg-surface-900 px-3 py-3 space-y-0.5 animate-slide-up">
            {isAdmin && (
              <>
                <Link to="/admin" className="flex items-center gap-3 text-brand-400 py-2.5 px-3 rounded-xl text-sm hover:bg-surface-800 transition-colors">
                  <HiCog className="w-4 h-4" /> Yönetim Paneli
                </Link>
                <button onClick={() => { logout(); navigate("/"); }}
                  className="flex w-full items-center gap-3 text-gray-500 py-2.5 px-3 rounded-xl text-sm hover:bg-surface-800 transition-colors">
                  <HiX className="w-4 h-4" /> Çıkış Yap
                </button>
              </>
            )}
            {!isAdmin && (
              <Link to="/admin" className="flex items-center gap-3 text-gray-400 py-2.5 px-3 rounded-xl text-sm hover:bg-surface-800 transition-colors">
                <HiCog className="w-4 h-4" /> Giriş Yap
              </Link>
            )}
          </div>
        )}
      </header>

      {/* ── Mobile Bottom Nav ───────────────────────────────────── */}
      <MobileBottomNav isAdmin={isAdmin} />
    </>
  );
}

function MobileBottomNav({ isAdmin }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isPopular = searchParams.get("sort") === "views";
  const isHome = location.pathname === "/" && !isPopular;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] md:hidden bg-surface-900/95 backdrop-blur-md border-t border-white/8">
      <div className="flex items-center justify-around h-14 px-1 max-w-md mx-auto">
        <BottomNavItem to="/" icon={HiHome} label="Ana Sayfa" active={isHome} />
        <BottomNavItem to="/?sort=views" icon={HiFire} label="Popüler" active={isPopular} />
        {isAdmin
          ? <BottomNavItem to="/admin" icon={HiCog} label="Admin" active={location.pathname === "/admin"} />
          : <BottomNavItem to="/admin" icon={HiUser} label="Giriş" active={false} />
        }
      </div>
    </nav>
  );
}

function BottomNavItem({ to, icon: Icon, label, active }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-0.5 py-1 px-4 rounded-xl transition-all duration-200 min-w-[60px] touch-manipulation ${
        active ? "text-brand-400" : "text-gray-600 hover:text-gray-400"
      }`}
    >
      <Icon className={`w-5 h-5 transition-transform duration-200 ${active ? "scale-110" : ""}`} />
      <span className="text-[10px] font-medium">{label}</span>
      {active && <span className="w-1 h-1 rounded-full bg-brand-500 mt-0.5" />}
    </Link>
  );
}
