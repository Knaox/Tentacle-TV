// Le faux Jellyfin du banc des bibliothèques (mode proxy : sous /api/jellyfin).
// Calibré le 2026-10-02 sur le vrai serveur (backend de dev → Jellyfin 10.11,
// compte de test, lecture seule) :
//   page Items : ~55 ms + 0,22 ms/Kio + 40 ms quand le total est demandé ;
//     ~1 Kio par film sans MediaSources, 7,6 Kio avec ;
//   affiche à chaud : ~7 ms ; à froid (taille jamais demandée) 80 à 270 ms.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { LIB_FILMS, LIB_SERIES, SERVER_ID, USER, compare, render } from "./catalog.mjs";
import { json, send, sleep } from "./transport.mjs";

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
/** Les hauteurs d'affiche préparées (`prepareImages.mjs`). */
const SIZES = [240, 300, 360, 372, 400, 480, 560, 744];
const DETAIL_FIELDS = new Set(["Overview", "Genres", "MediaSources", "MediaStreams", "ProviderIds", "Studios", "People", "Taglines", "GenreItems", "ExternalUrls", "RemoteTrailers", "DateCreated", "SortName", "ParentId"]);
const GENRES = ["Action", "Aventure", "Comédie", "Drame", "Science-Fiction", "Thriller"];

export function createJellyfin({ catalog, mode, note, stats, imgDir }) {
  const { films, series, byId } = catalog;
  const warmed = new Set();
  let resizing = 0;

  async function items(res, url) {
    const q = url.searchParams;
    const parent = q.get("ParentId") ?? q.get("parentId");
    const fields = new Set((q.get("Fields") ?? q.get("fields") ?? "").split(",").filter(Boolean));
    const start = Number(q.get("StartIndex") ?? 0);
    const limit = Number(q.get("Limit") ?? 100);
    const ids = q.get("Ids") ?? q.get("ids");
    let pool = ids ? ids.split(",").map((id) => byId.get(id)).filter(Boolean) : parent === LIB_SERIES ? series : parent === LIB_FILMS ? films : [...films, ...series];
    const types = q.get("IncludeItemTypes");
    if (types) {
      const wanted = new Set(types.split(","));
      pool = pool.filter((e) => wanted.has(e.kind));
    }
    const filters = q.get("Filters") ?? "";
    if (q.get("IsFavorite") === "true" || filters.includes("IsFavorite")) pool = pool.filter((e) => e.base.UserData.IsFavorite);
    if (filters.includes("IsUnplayed")) pool = pool.filter((e) => !e.base.UserData.Played);
    if (filters.includes("IsResumable")) pool = pool.filter((e) => e.base.UserData.PlaybackPositionTicks > 0);
    if (!ids) pool = [...pool].sort(compare(q.get("SortBy") ?? "SortName", q.get("SortOrder") ?? "Ascending"));
    const page = pool.slice(start, start + limit);
    const withTotal = q.get("EnableTotalRecordCount") !== "false";
    const body = Buffer.from(JSON.stringify({ Items: page.map((e) => render(e, fields)), TotalRecordCount: withTotal ? pool.length : 0, StartIndex: start }));
    const kib = body.length / 1024;
    const serverMs = 55 + 0.22 * kib + (withTotal ? 40 : 0) + (Math.random() - 0.5) * 20;
    stats.items += 1;
    stats.itemsBytes += body.length;
    const lib = parent === LIB_FILMS ? "films" : parent === LIB_SERIES ? "séries" : "autre";
    note(`[items] ${lib} start=${start} limit=${limit} → ${page.length} (${kib.toFixed(0)} Kio, ${serverMs.toFixed(0)} ms serveur)${fields.has("MediaSources") ? " +MediaSources" : ""}${withTotal ? "" : " sans total"}`);
    return send(res, mode, 200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, body, serverMs);
  }

  async function image(res, id, type, url) {
    const q = url.searchParams;
    const entry = byId.get(id);
    if (!entry || (type !== "Primary" && type !== "Backdrop")) {
      res.writeHead(404);
      return res.end();
    }
    // La hauteur demandée, ramenée à la plus proche des tailles préparées.
    const want = Number(q.get("maxHeight") ?? q.get("fillHeight") ?? 0) || Math.round(Number(q.get("maxWidth") ?? q.get("fillWidth") ?? 320) * 1.5);
    const height = SIZES.reduce((best, s) => (Math.abs(s - want) < Math.abs(best - want) ? s : best), SIZES[0]);
    const body = fs.readFileSync(path.join(imgDir, `${entry.src.Id}-p${height}.jpg`));
    const key = `${id}:${type}:${want}`;
    if (mode.cold && !warmed.has(key)) {
      // Jellyfin réduit l'original à la première demande de cette taille.
      while (resizing >= 4) await sleep(5);
      resizing += 1;
      await sleep(80 + Math.random() * 120);
      resizing -= 1;
    }
    warmed.add(key);
    stats.images += 1;
    stats.imagesBytes += body.length;
    note(`[img] ${id.slice(0, 6)} ${type} h${want}`);
    return send(res, mode, 200, { "content-type": "image/jpeg", "cache-control": "private, max-age=86400, stale-while-revalidate=604800" }, body, mode.imgms + Math.random() * 4);
  }

  const views = () => ({
    Items: [
      { Id: LIB_FILMS, Name: "Films", CollectionType: "movies", Type: "CollectionFolder", ImageTags: {}, ServerId: SERVER_ID },
      { Id: LIB_SERIES, Name: "Séries", CollectionType: "tvshows", Type: "CollectionFolder", ImageTags: {}, ServerId: SERVER_ID },
    ],
    TotalRecordCount: 2,
  });

  return function jellyfin(req, res, jf, url) {
    let m;
    if ((m = jf.match(/^\/Items\/([0-9a-f]{32})\/Images\/(\w+)/i))) return image(res, m[1], m[2], url);
    if (/^\/(Users\/[^/]+\/)?Items$/i.test(jf)) return items(res, url);
    if (/^\/Users\/[^/]+\/Views$/i.test(jf) || /^\/UserViews$/i.test(jf)) return json(res, 200, views());
    if (/^\/Genres$/i.test(jf)) return json(res, 200, { Items: GENRES.map((n) => ({ Id: md5(`g-${n}`), Name: n, Type: "Genre" })), TotalRecordCount: GENRES.length });
    if ((m = jf.match(/^\/(?:Users\/[^/]+\/)?Items\/([0-9a-f]{32})$/i))) {
      const entry = byId.get(m[1]);
      return entry ? json(res, 200, render(entry, DETAIL_FIELDS)) : json(res, 404, {});
    }
    if (/\/Items\/Resume$/i.test(jf) || /^\/UserItems\/Resume$/i.test(jf) || /^\/Shows\/NextUp$/i.test(jf)) return json(res, 200, { Items: [], TotalRecordCount: 0 });
    if (/\/Items\/Latest$/i.test(jf)) return json(res, 200, films.slice(0, 16).map((e) => render(e, new Set(["PrimaryImageAspectRatio"]))));
    if (/^\/System\/Info\/Public$/i.test(jf)) return json(res, 200, { ServerName: "Banc", Version: "10.11.0", Id: SERVER_ID, ProductName: "Jellyfin Server" });
    if (/^\/Users\/[^/]+$/i.test(jf) || /^\/Users\/Me$/i.test(jf)) return json(res, 200, USER);
    if (/^\/Sessions/i.test(jf)) {
      res.writeHead(204);
      return res.end();
    }
    if (/\/Ancestors$/i.test(jf)) return json(res, 200, []);
    if (/^\/MediaSegments\//i.test(jf)) return json(res, 200, { Items: [], TotalRecordCount: 0 });
    if (/^\/Users\/[^/]+\/Images\//i.test(jf)) {
      res.writeHead(404);
      return res.end();
    }
    const unknown = `JF ${req.method} ${jf}`;
    stats.unknown[unknown] = (stats.unknown[unknown] ?? 0) + 1;
    return json(res, 200, { Items: [], TotalRecordCount: 0 });
  };
}
