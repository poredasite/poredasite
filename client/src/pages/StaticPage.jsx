import { useLocation, Link } from "react-router-dom";
import SEOHead from "../components/SEOHead";

const PAGE_DATA = {
  "/hakkimizda": {
    title: "Hakkımızda",
    content: `Bizi bizden baskasi bilemez .

“İğneyi kendine, çuvaldızı başkasına batır” atasözü; hoşlanmadığımız bir davranışı ya da eleştiriyi başkalarına yöneltmeden önce kendimizi sorgulamamız gerektiğini anlatır. İnsan, en küçük hatayı önce kendinde görmeli, bunun etkisini ve doğruluğunu değerlendirmeli; ancak bundan sonra aynı davranışı başkalarına uygulayıp uygulamayacağına karar vermelidir. Bu sayede hem daha adil hem de daha bilinçli bir tutum sergilenmiş olur.`,
  },
  "/gizlilik": {
    title: "Gizlilik Politikası",
    content: `gizlilik politikamiz cok gizlidir .

poreda.com sitesi ziyaretçilerin hiç bir bilgisini kayıt altına almaz ve/veya üçüncü kişiler ile paylaşmaz zaten olmayan Log kayıtlarını veremezsiniz bu yüzden DOEDA İnternet’te en güvendiğiniz Porno sitesi olarak liderliğini korumaktadır.

Poreda . com hiç bir bilgiyi, belgeyi ve herhangi bir meteryali hiç bir kişi, kişiler, kurum, kuruluş ve devlet, devletler ile paylaşmaz veya verileri saklamaz nedeni ise sitemizde yasa dışı pornografik videolar bulunmamaktadır keza paylaşılan videolar -üçüncü taraf video paylaşım siteleri ve serverleri- aracılığı ile yayımlanmaktadır.

Sevgili ziyaretçilerimiz gönül rahatlığı ile porno izleyebilirler..`,
  },
  "/hukuki": {
    title: "Hukuki Bildirim",
    content: ` hukuki .

poreda.com 5651 sayılı yasanın 5. maddesinde tanımlanan yer sağlayıcı olarak hizmet vermektedir. İlgili yasaya göre, web site yönetiminin hukuka aykırı içerikleri kontrol etme yükümlülüğü yoktur. Bu sebeple, sitemiz uyar ve kaldır prensibini benimsemiştir. Telif hakkına konu olan eserlerin yasal olmayan bir biçimde paylaşıldığını ve yasal haklarının çiğnendiğini düşünen hak sahipleri veya meslek birlikleri, poredasite.proton@me adresinden bize ulaşabilirler. Buraya ulaşan talep ve şikayetler hukuksal olarak incelenecek, şikayet yerinde görüldüğü takdirde, ihlal olduğu düşünülen içerikler sitemizden kaldırılacaktır.

İlgili Yasa:

MADDE 5 (1) Yer sağlayıcı, yer sağladığı içeriği kontrol etmek veya hukuka aykırı bir faaliyetin söz konusu olup olmadığını araştırmakla yükümlü değildir.

(2) Yer sağlayıcı, yer sağladığı hukuka aykırı içerikten, ceza sorumluluğu ile ilgili hükümler saklı kalmak kaydıyla, bu Kanunun 8 inci ve 9 uncu maddelerine göre haberdar edilmesi halinde ve teknik olarak imkân bulunduğu ölçüde hukuka aykırı içeriği yayından kaldırmakla yükümlüdür.

English translation:

All the videos that are involved in our website are added from general video websites like vk.com, mail.ru, google, etc. For productions whose copyright belongs to you, as long as you make a notice to “tws101@protonmail.com” email address, relevant production will be removed in 3 workday from our website.`,
  },
  "/bilgi-islem": {
    title: "Bilgi İşlem",
    content: `Bur bilgi işlem .

İletişim
Merhaba değerli ziyaretçiler bizimle mail yolu ile iletişim kurabilirsiniz, sitemizde eğer kişisel mahremiyetinizi rencide edici videolar var ise kaldırılması için ivedi şekilde 7/24 bizlere müracaatta bulunabilirsiniz.
Mail adresimiz:

poredasite@proton.me

⚠️ ÖNEMLİ DUYURU

Son günlerde, web sitemizin e-posta adresi taklit edilerek (spoofing yöntemiyle) üçüncü kişilerle iletişime geçildiği ve sitemizde reklam yayınlanacağı iddiasıyla ücret talep edildiği tespit edilmiştir.

Şu an itibarıyla web sitemiz üzerinden herhangi bir reklam satışı veya sponsorluk çalışması yapılmamaktadır.
Bu tür e-postalara ve tekliflere kesinlikle itibar etmeyiniz. Bu şekilde yapılan yazışma ve ödeme talepleri bize ait değildir ve bu kapsamda doğabilecek herhangi bir zarardan sorumluluk kabul etmemekteyiz.

Şüpheli bir e-posta almanız halinde yanıt vermeyiniz ve kesinlikle ödeme yapmayınız. Lütfen dikkatli olunuz.
 .`,
  },
};

export default function StaticPage() {
  const { pathname } = useLocation();
  const page = PAGE_DATA[pathname];

  if (!page) return null;

  return (
    <>
      <SEOHead title={page.title} noIndex={true} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 animate-fade-in">
        <Link to="/" className="text-gray-500 hover:text-white text-sm transition-colors mb-8 inline-block">
          ← Ana Sayfaya Dön
        </Link>
        <h1 className="font-display font-bold text-3xl text-white mb-8">{page.title}</h1>
        <div className="bg-surface-900 border border-surface-700/50 rounded-2xl p-6 sm:p-8">
          <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">{page.content}</p>
        </div>
      </div>
    </>
  );
}
