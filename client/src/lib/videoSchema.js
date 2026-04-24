const SITE_URL  = import.meta.env.VITE_SITE_URL || "https://xxxporeda.com";
const SITE_NAME = "xxxporeda";

function stripHtml(s) {
  return (s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// seconds → ISO 8601 duration (PT1H2M3S)
function isoDuration(s) {
  if (!s || s <= 0) return "PT0S";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${sec || (!h && !m) ? `${sec}S` : ""}`;
}

export function generateVideoSchema(video) {
  if (!video) return null;

  const url   = `${SITE_URL}/video/${video.slug || video._id}`;
  const embed = `${SITE_URL}/embed/${video._id}`;
  const tags = video.tags?.length ? video.tags.slice(0, 5).join(", ") : "";
  const desc  = stripHtml(video.description || "").slice(0, 200)
              || `${video.title}${tags ? ` — ${tags}` : ""} — ${SITE_NAME}'de ücretsiz izle`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name:             video.title || "",
    description:      desc,
    thumbnailUrl:     [video.thumbnailUrl].filter(Boolean),
    uploadDate:       new Date(video.createdAt).toISOString(),
    duration:         isoDuration(video.duration),
    contentUrl:       video.mp4FallbackUrl || url,
    embedUrl:         embed,
    url,
    isFamilyFriendly: false,
    regionsAllowed:   "TR",
    publisher: {
      "@type": "Organization",
      name:   SITE_NAME,
      url:    SITE_URL,
      logo:   {
        "@type":  "ImageObject",
        url:      `${SITE_URL}/logo.png`,
        width:    600,
        height:   60,
      },
    },
    potentialAction: {
      "@type":  "WatchAction",
      target:   url,
    },
  };

  if (video.tags?.length > 0) {
    schema.keywords = video.tags.join(", ");
  }

  if (video.views > 0) {
    schema.interactionStatistic = {
      "@type":            "InteractionCounter",
      interactionType:    { "@type": "WatchAction" },
      userInteractionCount: video.views,
    };
  }

  // hasPart Clip — highlight window (15%–15%+60s)
  if (video.duration > 60) {
    const start = Math.floor(video.duration * 0.15);
    const end   = Math.min(start + 60, video.duration);
    schema.hasPart = {
      "@type":       "Clip",
      name:          "Highlight",
      startOffset:   start,
      endOffset:     end,
      url,
    };
  }

  return schema;
}

// Serialize safely for dangerouslySetInnerHTML — escapes </script> inside JSON
export function serializeSchema(schema) {
  return JSON.stringify(schema).replace(/<\/script>/gi, "<\\/script>");
}
