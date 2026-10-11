// Vercel serverless function: GET /api/youtube?channel=UCxxxx&n=4
// Returns a channel's latest uploads from YouTube's public RSS feed. No API key needed.

const decode = (s) =>
  String(s || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&amp;/g, "&");

module.exports = async (req, res) => {
  const send = (code, obj, cache) => {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", cache || "no-store");
    res.end(JSON.stringify(obj));
  };

  const q = new URL(req.url, "http://localhost").searchParams;
  const channel = String(q.get("channel") || process.env.YOUTUBE_CHANNEL_ID || "").trim();
  if (!/^UC[\w-]{22}$/.test(channel)) return send(400, { error: "bad_channel", message: "Channel ID should start with UC and be 24 characters." });
  const n = Math.min(Math.max(parseInt(q.get("n") || "4", 10) || 4, 1), 15);
  const includeShorts = q.get("shorts") === "1";

  try {
    const r = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + channel, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CreatorHub/1.0)" },
    });
    if (!r.ok) throw new Error("YouTube feed failed (" + r.status + ")");
    const xml = await r.text();
    const feedTitle = (xml.match(/<title>([^<]*)<\/title>/) || [])[1] || "";

    const all = xml.split("<entry>").slice(1).map((e) => {
      const get = (re) => { const m = e.match(re); return m ? decode(m[1]) : ""; };
      const id = get(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const link = get(/<link rel="alternate" href="([^"]+)"/);
      return {
        id,
        title: get(/<title>([\s\S]*?)<\/title>/),
        published: get(/<published>([^<]+)<\/published>/),
        views: parseInt(get(/<media:statistics views="(\d+)"/), 10) || null,
        thumbnail: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
        url: link || "https://www.youtube.com/watch?v=" + id,
        short: /\/shorts\//.test(link),
      };
    }).filter((v) => v.id);

    let videos = includeShorts ? all : all.filter((v) => !v.short);
    if (!videos.length) videos = all; // channel only posts Shorts — show them anyway

    send(200, { channel: { id: channel, title: decode(feedTitle) }, videos: videos.slice(0, n), updatedAt: new Date().toISOString() },
      "s-maxage=600, stale-while-revalidate=3600");
  } catch (e) {
    send(502, { error: "youtube_error", message: String((e && e.message) || e) });
  }
};
