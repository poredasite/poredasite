import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-surface-700/40 bg-gradient-to-b from-surface-900 to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <Link to="/" className="flex items-center gap-2 w-fit">
              <span className="text-2xl select-none" role="img" aria-label="cool">😎</span>
              <span className="font-display font-bold text-xl text-white tracking-tight">
                pore<span className="text-brand-500">da</span>
              </span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              Porno en iyisi sex seyret poreda ile sikiş seyret
            </p>
          </div>

          {/* Navigasyon */}
          <div>
            <h3 className="text-gray-400 font-semibold text-xs mb-4 uppercase tracking-widest">
              Navigasyon
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/"
                  className="text-gray-500 hover:text-brand-400 text-sm transition-colors duration-200"
                >
                  Ana Sayfa
                </Link>
              </li>
            </ul>
          </div>

          {/* Kaynaklar */}
          <div>
            <h3 className="text-gray-400 font-semibold text-xs mb-4 uppercase tracking-widest">
              Kaynaklar
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: "/sitemap.xml", label: "Sitemap" },
                { href: "/robots.txt", label: "Robots.txt" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-brand-400 text-sm transition-colors duration-200"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-surface-700/30 mt-10 pt-6 flex flex-col items-center sm:flex-row sm:justify-between gap-2 text-center sm:text-left">
          <p className="text-gray-600 text-xs">
            © {new Date().getFullYear()} VideoSite. Tüm hakları saklıdır.
          </p>
          <p className="text-gray-700 text-xs font-mono">
            React + Node.js + Cloudinary ile yapıldı
          </p>
        </div>
      </div>
    </footer>
  );
}
