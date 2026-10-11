// Vercel serverless function: GET /api/twitch?login=arky&clips=6&range=30
// Returns live status, the latest past broadcast and top clips for a Twitch channel.
//
// Needs two environment variables in Vercel (Project → Settings → Environment Variables):
//   TWITCH_CLIENT_ID      from https://dev.twitch.tv/console/apps
//   TWITCH_CLIENT_SECRET  from the same app ("New Secret")
// The secret stays on the server; it is never sent to visitors.

let TOKEN = { value: null, exp: 0 };

async function getToken(id, secret) {
  if (TOKEN.value && Date.now() < TOKEN.exp - 60000) return TOKEN.value;
  const r = await fetch(
    "https://id.twitch.tv/oauth2/token?client_id=" + encodeURIComponent(id) +
      "&client_secret=" + encodeURIComponent(secret) + "&grant_type=client_credentials",
    { method: "POST" }
  );
  if (!r.ok) throw new Error("Twitch login failed (" + r.status + ") — check the client ID and secret");
  const j = await r.json();
  TOKEN = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return TOKEN.value;
}

const fill = (u, w, h) => String(u || "").replace(/%?\{width\}/, w).replace(/%?\{height\}/, h);

module.exports = async (req, res) => {
  const send = (code, obj, cache) => {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", cache || "no-store");
    res.end(JSON.stringify(obj));
  };

  const id = process.env.TWITCH_CLIENT_ID, secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) {
    return send(503, { error: "not_configured", message: "Add TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in your Vercel project settings, then redeploy." });
  }

  const q = new URL(req.url, "http://localhost").searchParams;
  const login = String(q.get("login") || process.env.TWITCH_LOGIN || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!login) return send(400, { error: "missing_login" });
  const n = Math.min(Math.max(parseInt(q.get("clips") || "6", 10) || 6, 1), 20);
  const range = q.get("range") === "all" ? 0 : Math.min(Math.max(parseInt(q.get("range") || "30", 10) || 30, 1), 365);

  try {
    const token = await getToken(id, secret);
    const headers = { "Client-Id": id, Authorization: "Bearer " + token };
    const api = async (path) => {
      const r = await fetch("https://api.twitch.tv/helix/" + path, { headers });
      if (r.status === 401) TOKEN = { value: null, exp: 0 };
      if (!r.ok) throw new Error("Twitch " + path.split("?")[0] + " failed (" + r.status + ")");
      return (await r.json()).data || [];
    };

    const [user] = await api("users?login=" + login);
    if (!user) return send(404, { error: "user_not_found" }, "s-maxage=300");

    const now = new Date();
    const clipQuery = (days) =>
      "clips?broadcaster_id=" + user.id + "&first=" + n +
      (days ? "&started_at=" + new Date(now - days * 864e5).toISOString() + "&ended_at=" + now.toISOString() : "");

    const [streams, recentClips, vods] = await Promise.all([
      api("streams?user_id=" + user.id),
      api(clipQuery(range)),
      api("videos?user_id=" + user.id + "&type=archive&first=1"),
    ]);

    // Not enough clips in the chosen window? Top up with all-time favourites.
    let clips = recentClips;
    if (range && clips.length < n) {
      const seen = new Set(clips.map((c) => c.id));
      clips = clips.concat((await api(clipQuery(0))).filter((c) => !seen.has(c.id))).slice(0, n);
    }

    const s = streams[0], v = vods[0];
    send(200, {
      user: { login: user.login, name: user.display_name, avatar: user.profile_image_url },
      live: s ? { title: s.title, game: s.game_name, viewers: s.viewer_count, startedAt: s.started_at, thumbnail: fill(s.thumbnail_url, 1280, 720) } : null,
      latestVod: v ? { id: v.id, title: v.title, duration: v.duration, views: v.view_count, createdAt: v.created_at, url: v.url, thumbnail: fill(v.thumbnail_url, 1280, 720) } : null,
      clips: clips.map((c) => ({ id: c.id, title: c.title, views: c.view_count, createdAt: c.created_at, duration: c.duration, url: c.url, thumbnail: c.thumbnail_url, creator: c.creator_name })),
      updatedAt: now.toISOString(),
    }, "s-maxage=120, stale-while-revalidate=600");
  } catch (e) {
    send(502, { error: "twitch_error", message: String((e && e.message) || e) });
  }
};
