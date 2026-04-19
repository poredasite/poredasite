const BOT_UA = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|rogerbot/i;

const RAILWAY = "https://poredasite-production.up.railway.app";

export const config = {
  matcher: ["/", "/video/:path*", "/tag/:path*"],
};

export default async function middleware(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!BOT_UA.test(ua)) return;

  const { pathname } = new URL(request.url);

  try {
    const resp = await fetch(`${RAILWAY}/prerender${pathname}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return;
    const html = await resp.text();
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "x-prerender": "1" },
    });
  } catch {
    return;
  }
}
