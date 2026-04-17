import { HashRouter as BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminProvider } from "./context/AdminContext";
import { AdsProvider } from "./context/AdsContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { StickyBannerAd, PopunderAd, InstantMessageAd } from "./components/AdPlaceholders";
import Home from "./pages/Home";
import VideoDetail from "./pages/VideoDetail";
import Admin from "./pages/Admin";
import StaticPage from "./pages/StaticPage";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <AdminProvider>
      <AdsProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-black">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/video/:id" element={<VideoDetail />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/hakkimizda" element={<StaticPage />} />
                <Route path="/gizlilik" element={<StaticPage />} />
                <Route path="/hukuki" element={<StaticPage />} />
                <Route path="/bilgi-islem" element={<StaticPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
            <StickyBannerAd />
            <PopunderAd />
            <InstantMessageAd />
          </div>
        </BrowserRouter>
      </AdsProvider>
    </AdminProvider>
  );
}
