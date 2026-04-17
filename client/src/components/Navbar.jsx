import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAdmin } from "../context/AdminContext";

export default function Navbar() {
  const { isAdmin, logout } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/5">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0" aria-label="xxxporeda Ana Sayfa">
          <div className="w-7 h-7 bg-brand-500 rounded flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="font-display font-bold text-lg sm:text-xl text-white tracking-tight">
            xxxpor<span className="text-brand-500">eda</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1 ml-auto mr-4">
          <Link to="/"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
              ${isActive("/") ? "text-white bg-surface-700" : "text-gray-500 hover:text-white hover:bg-surface-800"}`}>
            Ana Sayfa
          </Link>
        </div>

        {isAdmin && (
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <Link to="/admin" className="text-brand-400 hover:text-brand-300 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-surface-800 transition-all">
              Yönetim
            </Link>
            <button onClick={() => { logout(); navigate("/"); }}
              className="text-sm text-gray-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-surface-800 transition-colors">
              Çıkış
            </button>
          </div>
        )}

        <button
          className="md:hidden p-2 rounded-lg text-gray-500 hover:text-white hover:bg-surface-800 transition-colors ml-auto"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menü"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </nav>

      {menuOpen && (
        <div className="md:hidden border-t border-white/5 bg-surface-900 px-3 py-3 space-y-1 animate-fade-in">
          <Link to="/" onClick={() => setMenuOpen(false)}
            className={`flex items-center py-2.5 px-3 rounded-xl text-sm transition-colors
              ${isActive("/") ? "text-white bg-surface-700" : "text-gray-400 hover:text-white hover:bg-surface-800"}`}>
            Ana Sayfa
          </Link>
          {isAdmin && (
            <div className="border-t border-white/5 pt-2 mt-2 space-y-1">
              <Link to="/admin" onClick={() => setMenuOpen(false)}
                className="flex items-center text-brand-400 py-2.5 px-3 rounded-xl text-sm hover:bg-surface-800 transition-colors">
                Yönetim Paneli
              </Link>
              <button onClick={() => { logout(); navigate("/"); setMenuOpen(false); }}
                className="flex w-full items-center text-gray-500 py-2.5 px-3 rounded-xl text-sm hover:bg-surface-800 transition-colors">
                Çıkış
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
