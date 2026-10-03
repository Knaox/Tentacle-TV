// Le FAUX JELLYFIN (mode proxy : tout passe par /api/jellyfin), nourri par le
// jeu de données. Assez fidèle pour que l'app refondue parcoure ses écrans
// (accueil, bibliothèques, fiches, saisons, Ma liste, favoris) ; jamais un
// octet du vrai serveur. Les écritures de l'utilisateur s'appliquent au jeu.
import fs from "node:fs";
import path from "node:path";

const page = (items, total = items.length) => ({ Items: items, TotalRecordCount: total, StartIndex: 0 });
const ids = (value) => String(value ?? "").split(",").map((v) => v.trim()).filter(Boolean);

/** Le tri Jellyfin (clé principale de `SortBy`), stable : à égalité, l'identifiant. */
function sorter(sortBy, order) {
  const key = String(sortBy ?? "SortName").split(",")[0];
  const dir = order === "Descending" ? -1 : 1;
  const value = (item) => {
    switch (key) {
      case "DateCreated": return item.DateCreated ?? "";
      case "PremiereDate": return item.PremiereDate ?? "";
      case "ProductionYear": return item.ProductionYear ?? 0;
      case "CommunityRating": return item.CommunityRating ?? 0;
      case "DatePlayed": return item.UserData?.LastPlayedDate ?? "";
      case "Random": return item.Id; // déterministe : jamais de hasard au banc
      default: return (item.SortName ?? item.Name ?? "").toLowerCase();
    }
  };
  return (a, b) => {
    const [x, y] = [value(a), value(b)];
    const d = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
    return d * dir || a.Id.localeCompare(b.Id);
  };
}

export function createJellyfin({ data, json, snapDir }) {
  const all = () => Object.values(data.snapshot.items).map((entry) => entry.item);
  const libraryOf = (id) => data.libraries().find((lib) => (data.snapshot.catalog?.[lib.id] ?? []).includes(id)) ?? null;

  function image(res, id, type) {
    const file = id === "profile" ? data.snapshot.profile?.image : data.snapshot.items[id]?.images?.[type];
    const full = file ? path.join(snapDir, file) : null;
    if (!full || !fs.existsSync(full)) return json(res, 404, {});
    res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "max-age=3600" });
    fs.createReadStream(full).pipe(res);
  }

  /** `/Items` et `/Users/{u}/Items` : ce qu'une requête de liste demande. */
  function items(url) {
    const q = url.searchParams;
    const parent = q.get("ParentId") ?? q.get("parentId");
    const filters = ids(q.get("Filters"));
    let list;
    if (q.get("Ids")) list = data.itemsOf(ids(q.get("Ids")));
    else if (parent && data.snapshot.catalog?.[parent]) list = data.itemsOf(data.snapshot.catalog[parent]);
    else if (parent && data.snapshot.credits?.[parent]) list = data.itemsOf(data.snapshot.credits[parent]);
    else if (parent && data.snapshot.episodes?.[parent]) list = data.itemsOf(data.snapshot.episodes[parent]);
    else if (parent && data.snapshot.seasons?.[parent]) list = data.itemsOf(data.snapshot.seasons[parent]);
    else list = all().filter((item) => item.Type === "Movie" || item.Type === "Series" || item.Type === "Episode");
    const types = ids(q.get("IncludeItemTypes"));
    if (types.length) list = list.filter((item) => types.includes(item.Type));
    if (filters.includes("IsFavorite")) list = list.filter((item) => item.UserData?.IsFavorite);
    if (filters.includes("Likes")) list = list.filter((item) => item.UserData?.Likes === true);
    if (filters.includes("IsPlayed")) list = list.filter((item) => item.UserData?.Played);
    if (filters.includes("IsUnplayed")) list = list.filter((item) => !item.UserData?.Played);
    if (filters.includes("IsResumable")) list = list.filter((item) => item.UserData?.PlaybackPositionTicks > 0);
    const person = q.get("PersonIds");
    if (person) list = list.filter((item) => (item.People ?? []).some((p) => ids(person).includes(p.Id)));
    const genres = ids(q.get("GenreIds"));
    if (genres.length) list = list.filter((item) => (item.GenreItems ?? []).some((g) => genres.includes(g.Id)));
    const genreNames = String(q.get("Genres") ?? "").split("|").filter(Boolean);
    if (genreNames.length) list = list.filter((item) => (item.Genres ?? []).some((g) => genreNames.includes(g)));
    const term = (q.get("searchTerm") ?? q.get("SearchTerm") ?? "").toLowerCase();
    if (term) list = list.filter((item) => data.clean(item.Name).toLowerCase().includes(term));
    if (q.get("SortBy") && !q.get("Ids")) list = [...list].sort(sorter(q.get("SortBy"), q.get("SortOrder")));
    const total = list.length;
    const start = Number(q.get("StartIndex") ?? 0);
    const limit = q.get("Limit") ? Number(q.get("Limit")) : undefined;
    return page(list.slice(start, limit ? start + limit : undefined), total);
  }

  function setFlag(res, id, patch) {
    const item = data.item(id);
    if (!item) return json(res, 404, {});
    return json(res, 200, data.setUserData(id, patch));
  }

  /** Rend `true` si la route est servie. `jf` : le chemin sans `/api/jellyfin`. */
  return function jellyfin(req, res, jf, url) {
    const m = req.method;
    let hit;
    if ((hit = jf.match(/^\/Items\/([^/]+)\/Images\/([^/?]+)/i))) return image(res, hit[1], hit[2]), true;
    if (/^\/Users\/[^/]+\/Images\/Primary/i.test(jf)) return image(res, "profile"), true;
    if (/^\/System\/Info(\/Public)?$/i.test(jf)) return json(res, 200, { ServerName: "Banc", Version: "10.11.0", Id: "banc", ProductName: "Jellyfin Server", StartupWizardCompleted: true }), true;
    if (/^\/Sessions/i.test(jf)) return res.writeHead(204), res.end(), true;
    if (/^\/Playback\/BitrateTest$/i.test(jf)) {
      // La mesure de débit de l'app : des octets, plafonnés (le banc n'est pas un lien réseau).
      const size = Math.min(Number(url.searchParams.get("size") ?? url.searchParams.get("Size") ?? 500_000), 2_000_000);
      res.writeHead(200, { "content-type": "application/octet-stream", "content-length": size });
      return res.end(Buffer.alloc(size)), true;
    }
    if ((hit = jf.match(/^\/(?:Users\/[^/]+\/FavoriteItems|UserFavoriteItems)\/([^/?]+)$/i))) return setFlag(res, hit[1], { IsFavorite: m !== "DELETE" }), true;
    if ((hit = jf.match(/^\/(?:Users\/[^/]+\/PlayedItems|UserPlayedItems)\/([^/?]+)$/i))) return setFlag(res, hit[1], { Played: m !== "DELETE", PlayCount: m === "DELETE" ? 0 : 1 }), true;
    if ((hit = jf.match(/^\/Users\/[^/]+\/Items\/([^/?]+)\/Rating$/i))) return setFlag(res, hit[1], { Likes: m === "DELETE" ? null : url.searchParams.get("likes") !== "false" }), true;
    if ((hit = jf.match(/^\/UserItems\/([^/?]+)\/UserData$/i))) return json(res, 200, data.item(hit[1])?.UserData ?? {}), true;
    if (/^\/Users\/[^/]+\/Views$/i.test(jf)) {
      return json(res, 200, page(data.libraries().map((l) => ({ Id: l.id, Name: l.name, CollectionType: l.collectionType, Type: "CollectionFolder", ServerId: "banc" })))), true;
    }
    if (/^\/Users\/[^/]+\/Items\/Resume$/i.test(jf)) return json(res, 200, page(data.list("resume"))), true;
    if (/\/Items\/Latest$/i.test(jf)) {
      const parent = url.searchParams.get("ParentId");
      const list = parent ? data.itemsOf(data.snapshot.latestByLibrary?.[parent]) : data.list("latest");
      return json(res, 200, list.slice(0, Number(url.searchParams.get("Limit") ?? 16))), true;
    }
    if (/^\/Shows\/NextUp$/i.test(jf)) {
      const series = url.searchParams.get("seriesId") ?? url.searchParams.get("SeriesId");
      const list = data.list("nextUp").filter((item) => !series || item.SeriesId === series);
      return json(res, 200, page(list.slice(0, Number(url.searchParams.get("Limit") ?? 12)))), true;
    }
    if ((hit = jf.match(/^\/Shows\/([^/]+)\/Seasons$/i))) return json(res, 200, page(data.itemsOf(data.snapshot.seasons?.[hit[1]]))), true;
    if ((hit = jf.match(/^\/Shows\/([^/]+)\/Episodes$/i))) {
      const season = url.searchParams.get("SeasonId") ?? url.searchParams.get("seasonId");
      let list = season ? data.itemsOf(data.snapshot.episodes?.[season])
        : (data.snapshot.seasons?.[hit[1]] ?? []).flatMap((s) => data.itemsOf(data.snapshot.episodes?.[s]));
      const startAt = url.searchParams.get("startItemId");
      if (startAt) list = list.slice(Math.max(0, list.findIndex((item) => item.Id === startAt)));
      return json(res, 200, page(list)), true;
    }
    if ((hit = jf.match(/^\/Items\/([^/]+)\/Similar$/i))) {
      return json(res, 200, page(data.itemsOf(data.detail(hit[1])?.similar).slice(0, Number(url.searchParams.get("Limit") ?? 24)))), true;
    }
    if ((hit = jf.match(/^\/Users\/[^/]+\/Items\/([^/]+)\/SpecialFeatures$/i))) return json(res, 200, data.itemsOf(data.detail(hit[1])?.specialFeatures)), true;
    if ((hit = jf.match(/^\/Users\/[^/]+\/Items\/([^/]+)\/LocalTrailers$/i))) return json(res, 200, data.itemsOf(data.detail(hit[1])?.localTrailers)), true;
    if (/^\/Items\/[^/]+\/Collections$/i.test(jf)) return json(res, 200, page([])), true;
    if ((hit = jf.match(/^\/Items\/([^/]+)\/Ancestors$/i))) {
      const lib = libraryOf(hit[1]);
      return json(res, 200, lib ? [{ Id: lib.id, Name: lib.name, Type: "CollectionFolder", CollectionType: lib.collectionType }] : []), true;
    }
    if (/^\/Items\/Filters2?$/i.test(jf)) {
      const genres = data.snapshot.genres?.[url.searchParams.get("parentId") ?? url.searchParams.get("ParentId")] ?? [];
      return json(res, 200, { Genres: genres.map((g) => ({ Name: g.name, Id: g.id })), Tags: [], OfficialRatings: [], Years: [] }), true;
    }
    if (/^\/Genres$/i.test(jf)) {
      const genres = data.snapshot.genres?.[url.searchParams.get("ParentId")] ?? [];
      return json(res, 200, page(genres.map((g) => ({ Name: g.name, Id: g.id, Type: "Genre" })))), true;
    }
    if (/^\/Studios$/i.test(jf)) return json(res, 200, page([])), true;
    if ((hit = jf.match(/^\/Items\/([^/]+)\/PlaybackInfo$/i))) {
      const item = data.item(hit[1]);
      return json(res, item ? 200 : 404, item ? { MediaSources: item.MediaSources ?? [], PlaySessionId: `banc-${hit[1]}` } : {}), true;
    }
    if ((hit = jf.match(/^\/(?:Users\/[^/]+\/)?Items\/([0-9a-f]{32})$/i))) {
      const item = data.item(hit[1]);
      return json(res, item ? 200 : 404, item ?? {}), true;
    }
    if (/^\/Users\/[^/]+$/i.test(jf) || /^\/Users\/Me$/i.test(jf)) {
      return json(res, 200, { Id: "banc-user", Name: data.snapshot.profile?.name ?? "Banc", ServerId: "banc", HasPassword: true, Policy: { IsAdministrator: false, EnableContentDownloading: false }, Configuration: { AudioLanguagePreference: "fra", SubtitleLanguagePreference: "fra" } }), true;
    }
    if (/^\/(Users\/[^/]+\/)?Items$/i.test(jf)) return json(res, 200, items(url)), true;
    return false;
  };
}
