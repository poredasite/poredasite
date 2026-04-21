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
    content: "VR porno izle yada kendine bir iyilik yap bu İnternet sitesinde arkadaşların ile beraber Gangbang tadında 4K sexli filmler seyret. Dünyaca ünlü +18 yasaklı video sitelerine giriş yapmak istiyorsanız yolunuz bir şekilde DoEda tarafından geçer sonrası pratik giriş sayesinde yüz binlerce videolara kolaylıkla ulaşabilirsiniz.",
  },
];

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-white/[0.05] bg-surface-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* ── Brand + tagline ─────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl select-none">😎</span>
            <span className="font-display font-bold text-lg text-white tracking-tight">
              xxxpor<span className="text-brand-500">eda</span>
            </span>
          </Link>
          <div className="w-px h-5 bg-white/8" />
          <p className="text-neutral-600 text-xs">
            Türkiye'nin porno platformu
          </p>
        </div>

        {/* ── Link columns ────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
          {FOOTER_SECTIONS.map(({ title, to, content }) => (
            <div key={title} className="flex flex-col gap-2">
              <Link
                to={to}
                className="text-neutral-300 font-medium text-xs hover:text-brand-400 transition-colors w-fit"
              >
                {title}
              </Link>
              <p className="text-neutral-700 text-[11px] leading-relaxed line-clamp-3">
                {content}
              </p>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ──────────────────────────────────────── */}
        <div className="border-t border-white/[0.04] pt-5 flex flex-col sm:flex-row sm:justify-between gap-2">
          <p className="text-neutral-700 text-xs">
            © {new Date().getFullYear()} xxxporeda. Tüm hakları saklıdır.
          </p>
          <p className="text-neutral-800 text-xs font-mono">
            React + Node.js + Cloudflare R2
          </p>
        </div>
      </div>
    </footer>
  );
}
