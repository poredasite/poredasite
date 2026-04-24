import { Helmet } from "react-helmet-async";
import { generateVideoSchema, serializeSchema } from "../lib/videoSchema";

const SITE_NAME = "xxxporeda";
const SITE_URL  = import.meta.env.VITE_SITE_URL || "https://xxxporeda.com";
const DEFAULT_DESCRIPTION =
  "HD kalitede altyazılı ve dublajlı sikiş videoları. Türkiye'nin en iyi porno platformu. Ücretsiz, kayıt gerektirmez.";

function buildBreadcrumb(items) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type":   "ListItem",
      position:  i + 1,
      name:      item.name,
      item:      item.url,
    })),
  }).replace(/<\/script>/gi, "<\\/script>");
}

export default function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  image,
  url,
  type        = "website",
  videoUrl,
  noIndex     = false,
  prevPage    = null,
  nextPage    = null,
  videoObject = null,
  breadcrumbs = null,   // array of { name, url } — auto-built for video pages
}) {
  const fullTitle    = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} Porno izle`;
  const canonicalUrl = url ? `${SITE_URL}${url}` : SITE_URL;

  // Auto breadcrumb for video pages
  const crumbs = breadcrumbs || (videoObject ? [
    { name: SITE_NAME,          url: SITE_URL },
    { name: videoObject.title,  url: canonicalUrl },
  ] : null);

  return (
    <Helmet>
      {/* Primary */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex
        ? <meta name="robots" content="noindex, nofollow" />
        : <meta name="robots" content="index, follow" />
      }
      <link rel="canonical" href={canonicalUrl} />
      {prevPage && <link rel="prev" href={`${SITE_URL}${prevPage}`} />}
      {nextPage && <link rel="next" href={`${SITE_URL}${nextPage}`} />}

      {/* Hreflang */}
      <link rel="alternate" hreflang="tr"        href={canonicalUrl} />
      <link rel="alternate" hreflang="x-default" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type"        content={type} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url"         content={canonicalUrl} />
      <meta property="og:site_name"   content={SITE_NAME} />
      <meta property="og:locale"      content="tr_TR" />
      {image && <meta property="og:image"        content={image} />}
      {image && <meta property="og:image:width"  content="1280" />}
      {image && <meta property="og:image:height" content="720" />}

      {/* Twitter */}
      <meta name="twitter:card"        content={image ? "summary_large_image" : "summary"} />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {/* Video OG */}
      {videoUrl && <meta property="og:video"        content={videoUrl} />}
      {videoUrl && <meta property="og:video:type"   content="video/mp4" />}
      {videoUrl && <meta property="og:video:width"  content="1280" />}
      {videoUrl && <meta property="og:video:height" content="720" />}

      {/* VideoObject JSON-LD */}
      {videoObject ? (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeSchema(generateVideoSchema(videoObject)) }}
        />
      ) : videoUrl ? (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeSchema({
            "@context":    "https://schema.org",
            "@type":       "VideoObject",
            name:          title,
            description,
            thumbnailUrl:  image,
            contentUrl:    videoUrl,
            embedUrl:      canonicalUrl,
            uploadDate:    new Date().toISOString(),
          })}}
        />
      ) : null}

      {/* BreadcrumbList JSON-LD */}
      {crumbs && crumbs.length > 1 && (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: buildBreadcrumb(crumbs) }}
        />
      )}
    </Helmet>
  );
}
