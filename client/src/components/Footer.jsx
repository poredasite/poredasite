import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-surface-700/50 bg-surface-900 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-3">
            <span className="text-2xl select-none" role="img" aria-label="cool">😎</span>
              <span className="font-display font-bold text-lg text-white">
                pore<span className="text-brand-500">da</span>
              </span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed">
              Türkiye'nin oyun ve vlog platformu. Hızlı, temiz, reklamsız.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-white font-display font-semibold text-sm mb-3 uppercase tracking-wider">
              Navigasyon
            </h3>
            <ul className="space-y-2">
              {[
                { to: "/", label: "Ana Sayfa" },
                { to: "/admin", label: "Yönetim Paneli" },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="text-gray-500 hover:text-brand-400 text-sm transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* SEO / Tech */}
          <div>
            <h3 className="text-white font-display font-semibold text-sm mb-3 uppercase tracking-wider">
              Kaynaklar
            </h3>
            <ul className="space-y-2">
              {[
                { href: "/sitemap.xml", label: "Sitemap" },
                { href: "/robots.txt", label: "Robots.txt" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-brand-400 text-sm transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-surface-700/40 mt-8 pt-6 flex flex-col items-center sm:flex-row sm:justify-between gap-2 text-center sm:text-left">
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
