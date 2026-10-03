// Le JOURNAL du faux backend : chaque requête, numérotée, et les ÉCRITURES
// qu'on en tire — ce que l'app a fait d'observable côté serveur (Ma liste,
// favori, vu, note, lecture, demande Vigie…). Une écriture est une chaîne
// `genre` ou `genre @item` ; un `expect.writes` d'un scénario compare le genre
// (et l'item s'il le précise). Les lectures (GET) ne sont jamais des écritures.

const JELLYFIN = "/api/jellyfin";

// Ce qui n'est PAS une écriture de l'utilisateur, même en POST : la vie de
// fond de l'app (capacités de session, progression périodique, jeton).
const BACKGROUND = [
  /^\/Sessions\/Capabilities/i,
  /^\/Sessions\/Playing\/Progress$/i,
  /^\/Sessions\/Playing\/Ping$/i,
];
const BACKGROUND_TENTACLE = [/^\/api\/auth\/refresh$/, /^\/api\/trailers\/(prepare|report)$/];

/** L'écriture qu'une requête représente (`null` : aucune). */
export function classify(method, pathname, query, body) {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;
  if (pathname.startsWith(JELLYFIN)) return jellyfinWrite(method, pathname.slice(JELLYFIN.length), query);
  if (BACKGROUND_TENTACLE.some((re) => re.test(pathname))) return null;
  if (pathname === "/api/ratings" && method === "PUT") return `rating:${body?.score ?? "?"}${body?.jellyfinItemId ? ` @${body.jellyfinItemId}` : ""}`;
  if (pathname === "/api/ratings/item" && method === "DELETE") return "rating:remove";
  if (pathname === "/api/reco/feedback") return `reco:feedback:${body?.type ?? body?.kind ?? body?.action ?? "?"}${body?.key ? ` @${body.key}` : ""}`;
  const watch = pathname.match(/^\/api\/watchlist\/tmdb\/(\w+)\/(\d+)/);
  if (watch) return `watchlist:${method === "DELETE" ? "remove" : "add"} @${watch[1]}:${watch[2]}`;
  if (pathname === "/api/plugins/seer/titles/request") return `vigie:request${body?.key ? ` @${body.key}` : ""}${body?.seasons ? `#${body.seasons.join(",")}` : ""}`;
  const prefs = pathname.match(/^\/api\/preferences\/?(.*)$/);
  if (prefs) return `prefs:${prefs[1] || "all"}`;
  return `${method} ${pathname}`;
}

function jellyfinWrite(method, jf, query) {
  if (BACKGROUND.some((re) => re.test(jf))) return null;
  const remove = method === "DELETE";
  const fav = jf.match(/^\/(?:Users\/[^/]+\/FavoriteItems|UserFavoriteItems)\/([^/?]+)$/i);
  if (fav) return `favorite:${remove ? "remove" : "add"} @${fav[1]}`;
  const played = jf.match(/^\/(?:Users\/[^/]+\/PlayedItems|UserPlayedItems)\/([^/?]+)$/i);
  if (played) return `watched:${remove ? "remove" : "add"} @${played[1]}`;
  // « Ma liste » = le « j'aime » de Jellyfin (Filters=Likes).
  const like = jf.match(/^\/Users\/[^/]+\/Items\/([^/?]+)\/Rating$/i);
  if (like) return remove || query.get("likes") === "false" ? `watchlist:remove @${like[1]}` : `watchlist:add @${like[1]}`;
  const info = jf.match(/^\/Items\/([^/?]+)\/PlaybackInfo$/i);
  if (info) return `playback:info @${info[1]}`;
  if (/^\/Sessions\/Playing$/i.test(jf)) return "playback:start";
  if (/^\/Sessions\/Playing\/Stopped$/i.test(jf)) return "playback:stop";
  return `${method} ${JELLYFIN}${jf}`;
}

export function createJournal() {
  const entries = [];
  let seq = 0;
  let t0 = Date.now();
  return {
    record(method, pathname, query, body) {
      seq += 1;
      const write = classify(method, pathname, query, body);
      entries.push({ seq, t: Date.now() - t0, method, path: pathname, query: query.toString(), write });
      if (entries.length > 20000) entries.shift();
      return seq;
    },
    get seq() {
      return seq;
    },
    /** Les entrées après `since` ; `writes` : leurs écritures, dans l'ordre. */
    since(since = 0) {
      const after = entries.filter((entry) => entry.seq > since);
      return { seq, entries: after, writes: after.map((entry) => entry.write).filter(Boolean) };
    },
    reset() {
      entries.length = 0;
      t0 = Date.now();
    },
  };
}
