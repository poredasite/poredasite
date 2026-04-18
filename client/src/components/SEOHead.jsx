import { Helmet } from "react-helmet-async";

const SITE_NAME = "xxxporeda";
const SITE_URL = import.meta.env.VITE_SITE_URL || "https://xxxporeda.com";
const DEFAULT_DESCRIPTION =
  "Türkiye'nin en iyi porno altyazılı sikiş izleme ve sex platformu.";

export default function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  image,
  url,
  type = "website",
  videoUrl,
  noIndex = false,
  prevPage = null,
  nextPage = null,
}) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} Porno izle`;
  const canonicalUrl = url ? `${SITE_URL}${url}` : SITE_URL;

  return (
    <Helmet>
      {/* Primary */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={canonicalUrl} />
      {prevPage && <link rel="prev" href={`${SITE_URL}${prevPage}`} />}
      {nextPage && <link rel="next" href={`${SITE_URL}${nextPage}`} />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      {image && <meta property="og:image" content={image} />}
      {image && <meta property="og:image:width" content="1280" />}
      {image && <meta property="og:image:height" content="720" />}

      {/* Twitter Card */}
      <meta name="twitter:card" content={image ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {/* Video specific */}
      {videoUrl && <meta property="og:video" content={videoUrl} />}
      {videoUrl && <meta property="og:video:type" content="video/mp4" />}

      {/* Schema.org JSON-LD */}
      {videoUrl && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoObject",
            name: title,
            description: description,
            thumbnailUrl: image,
            contentUrl: videoUrl,
            embedUrl: canonicalUrl,
            uploadDate: new Date().toISOString(),
          })}
        </script>
      )}
    </Helmet>
  );
}
