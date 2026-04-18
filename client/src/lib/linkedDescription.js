// Injects up to 3 internal links into a description string:
//   1 tag link  →  /tag/:tag
//   1 video link →  /video/:id   (matches a related video's title in the text)
//   1 category link → /?category=:id  (matches category name in the text)
//
// Uses indexOf (not regex) for correct Turkish character matching.
// Returns an array of segments: { type: 'text'|'link', content, href }

function findAndReplace(segments, needle, makeSegment) {
  const lower = needle.toLowerCase();
  let found = false;
  const next = [];

  for (const seg of segments) {
    if (found || seg.type !== "text") { next.push(seg); continue; }

    const idx = seg.content.toLowerCase().indexOf(lower);
    if (idx === -1) { next.push(seg); continue; }

    // Word-boundary check (handles Turkish chars fine since we use indexOf)
    const before = seg.content[idx - 1];
    const after  = seg.content[idx + lower.length];
    const okStart = !before || /[\s,.()"'!?\-/]/.test(before);
    const okEnd   = !after  || /[\s,.()"'!?\-/]/.test(after);
    if (!okStart || !okEnd) { next.push(seg); continue; }

    if (idx > 0) next.push({ type: "text", content: seg.content.slice(0, idx) });
    next.push(makeSegment(seg.content.slice(idx, idx + needle.length)));
    next.push({ type: "text", content: seg.content.slice(idx + needle.length) });
    found = true;
  }

  return { segments: found ? next : segments, found };
}

export function parseLinkedDescription(
  text,
  { tags = [], relatedVideos = [], categories = [] } = {}
) {
  if (!text) return [{ type: "text", content: "" }];

  let segments = [{ type: "text", content: text }];
  let tagLinked = 0, videoLinked = 0, catLinked = 0;

  // ── 1. Tag links (max 1) ─────────────────────────────────────────────────
  const sortedTags = [...new Set(tags)]
    .filter((t) => t.length >= 3)
    .sort((a, b) => b.length - a.length);

  for (const tag of sortedTags) {
    if (tagLinked >= 1) break;
    const { segments: next, found } = findAndReplace(
      segments, tag,
      (content) => ({ type: "link", content, href: `/tag/${encodeURIComponent(tag.toLowerCase())}` })
    );
    if (found) { segments = next; tagLinked++; }
  }

  // ── 2. Video title link (max 1) ──────────────────────────────────────────
  // Only match if the full video title (≥ 8 chars) appears verbatim in the text
  const sortedVideos = [...relatedVideos]
    .filter((v) => v.title?.length >= 8)
    .sort((a, b) => b.title.length - a.title.length);

  for (const v of sortedVideos) {
    if (videoLinked >= 1) break;
    const { segments: next, found } = findAndReplace(
      segments, v.title,
      (content) => ({ type: "link", content, href: `/video/${v._id}` })
    );
    if (found) { segments = next; videoLinked++; }
  }

  // ── 3. Category link (max 1) ─────────────────────────────────────────────
  const sortedCats = [...categories]
    .filter((c) => c.name?.length >= 3)
    .sort((a, b) => b.name.length - a.name.length);

  for (const cat of sortedCats) {
    if (catLinked >= 1) break;
    const { segments: next, found } = findAndReplace(
      segments, cat.name,
      (content) => ({ type: "link", content, href: `/?category=${cat._id}` })
    );
    if (found) { segments = next; catLinked++; }
  }

  return segments;
}
