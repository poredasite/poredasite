import { lazy, Suspense, Component } from "react";
import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminProvider } from "./context/AdminContext";
import { AdsProvider } from "./context/AdsContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { StickyBannerAd, PopunderAd, InstantMessageAd } from "./components/AdPlaceholders";
import StaticPage from "./pages/StaticPage";
import NotFound from "./pages/NotFound";

const Home        = lazy(() => import("./pages/Home"));
const VideoDetail = lazy(() => import("./pages/VideoDetail"));
const Admin       = lazy(() => import("./pages/Admin"));
const TagPage     = lazy(() => import("./pages/TagPage"));
const Search      = lazy(() => import("./pages/Search"));
const EmbedPage   = lazy(() => import("./pages/EmbedPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-3 border-white/10 border-t-brand-500 rounded-full animate-spin" />
    </div>
  );
}

class ErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-white font-display font-bold text-lg">Bir hata oluştu</p>
          <button onClick={() => window.location.reload()} className="btn-primary text-sm">Sayfayı Yenile</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AdminProvider>
      <AdsProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <div className="min-h-screen flex flex-col bg-black">
              <Navbar />
              <main className="flex-1">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/video/:slug" element={<VideoDetail />} />
                    <Route path="/tag/:tag"  element={<TagPage />} />
                    <Route path="/search"   element={<Search />} />
                    <Route path="/embed/:id" element={<EmbedPage />} />
                    <Route path="/admin-baba" element={<Admin />} />
                    <Route path="/hakkimizda" element={<StaticPage />} />
                    <Route path="/gizlilik" element={<StaticPage />} />
                    <Route path="/hukuki" element={<StaticPage />} />
                    <Route path="/bilgi-islem" element={<StaticPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
              <StickyBannerAd />
              <PopunderAd />
              <InstantMessageAd />
              <Analytics />
            </div>
          </ErrorBoundary>
        </BrowserRouter>
      </AdsProvider>
    </AdminProvider>
  );
}
