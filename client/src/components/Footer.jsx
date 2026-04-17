import { Link } from "react-router-dom";

const FOOTER_SECTIONS = [
  {
    title: "Hakkımızda",
    to: "/hakkimizda",
    content: "xxxporeda.com - Copyright 2026 © Porno XXX Bedava Sex Video Porna Film Tecavüz Götten Sikiş İzle All rights reserved. Powered by Astalavista - Adam gibi porna film izle sitesi; Bilindiği üzere mobil reklamlar yüzünden Xvideos filmleri izlemeniz tamamen imkansız hale geldi artık sansürsüz ve reklamsız seks izleyin diye ücretsiz hızlı videolar izlet Adult film sitesi ile seyrettiğiniz videoları indirebilirsiniz",
  },
  {
    title: "Gizlilik",
    to: "/gizlilik",
    content: "sabah kuşağında taş gibi bir hatun ile oral seks yapabilirsin tüm bunları ücretsiz götten sikiş videoları ile gerçekleştir. Astalavista porno filmler sayesinde Full HD porna izlemek istemez misiniz? cevabınız evet ise kisa porno videolar akıllı telefonunuz üzerinden güvenli Wi-Fi bağlantısı yada 3G, 4G, 4,5G, 5G tamamen ücretsiz hatta kesintisiz ve naklen yayınlanıyor online sex",
  },
  {
    title: "Hukuki",
    to: "/hukuki",
    content: ". Kısa porno seyretmek isteyen lezbiyen kadınlar sitemizi ziyaret etmek için lez videosu arıyor olabilir Grup seks, götten sikiş hastası yada seks filmleri gibi çeşitli +18 videolar adresinde Xnxx gizli saklı olmadan yayınlanıyor yeni porno izleme dergisi bile geride kalmış İnternet teknolojisinin harika fikirlerini geçemiyor 3D sanal gerçeklik",
  },
  {
    title: "Bilgi İşlem",
    to: "/bilgi-islem",
    content: "VR porno izle yada kendine bir iyilik yap bu İnternet sitesinde arkadaşların ile beraber Gangbang tadında 4K sexli filmler seyret. Dünyaca ünlü +18 yasaklı video sitelerine giriş yapmak istiyorsanız yolunuz bir şekilde DoEda tarafından geçer sonrası pratik giriş sayesinde yüz binlerce videolara kolaylıkla ulaşabilirsiniz, bu sayede VPN yada Proxy gibi uzun soluklu uygulamalara APK gibi telefon uygulamasına ihtiyacınız olmadan giriş yapabilirsiniz.",
  },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-surface-700/40 bg-gradient-to-b from-surface-900 to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">

        {/* ── Üst: 4 menü sütunu ──────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          {FOOTER_SECTIONS.map(({ title, to, content }) => (
            <div key={title} className="flex flex-col gap-3">
              <Link
                to={to}
                className="text-white font-display font-semibold text-sm hover:text-brand-400 transition-colors w-fit"
              >
                {title}
              </Link>
              <p className="text-gray-600 text-xs leading-relaxed">
                {content}
              </p>
            </div>
          ))}
        </div>

        {/* ── Orta: brand + açıklama ──────────────────────────── */}
        <div className="border-t border-surface-700/30 pt-8 pb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-brand-500 rounded flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="font-display font-bold text-xl text-white tracking-tight">
              xxxpore<span className="text-brand-500">da</span>
            </span>
          </Link>
          <p className="text-gray-500 text-sm leading-relaxed sm:ml-4">
            Türkiye'nin Porno platformu izle doyma doy izle sex sikis durmadan izle purna.
          </p>
        </div>

        {/* ── Alt: telif + stack ──────────────────────────────── */}
        <div className="border-t border-surface-700/20 pt-5 flex flex-col sm:flex-row sm:justify-between gap-2">
          <p className="text-gray-600 text-xs">
            © {new Date().getFullYear()} xxxporeda. Tüm hakları saklıdır.
          </p>
          <p className="text-gray-700 text-xs font-mono">
            React + Node.js + Cloudinary
          </p>
        </div>
      </div>
    </footer>
  );
}
