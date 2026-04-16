import { Link } from "react-router-dom";
import SEOHead from "../components/SEOHead";

export default function NotFound() {
  return (
    <>
      <SEOHead title="404 — Page Not Found" noIndex={true} />
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 animate-fade-in">
        <div className="text-center max-w-sm">
          {/* Big 404 */}
          <div className="font-display font-black text-[120px] sm:text-[160px] leading-none
                          text-gradient opacity-20 select-none">
            404
          </div>
          <h1 className="font-display font-bold text-2xl text-white -mt-4 mb-3">
            Sayfa bulunamadı
          </h1>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            Aradığın sayfa mevcut değil veya taşınmış.
          </p>
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Ana Sayfaya Git
          </Link>
        </div>
      </div>
    </>
  );
}
