// Le FAUX VIGIE du banc des demandes en direct — voir README.md (et
// fakeServer.mjs, qui le sert sous /api/plugins/seer). Le contrat `titles` :
// `access`, `mine` (la liste avance seule au fil de l'horloge, temps restant
// compris, et chaque titre dit l'origine de sa demande), `state` et `request`
// (avec `demandes=on`, une demande entre dans la liste du banc — jamais
// relayée nulle part).
//
// Les saisons des séries du banc (`titles.seasons`, `titles.gaps`) :
// fakeSeasons.mjs.
//
// `createVigie(ctx)` — ctx : l'instantané et ses lecteurs (`snapshot`,
// `listOf`, `clean`, `poster`), le journal (`note`), la réponse (`json`), et
// l'horloge des titres (`clock.t0`, remise à zéro par `/__reset`).

import { gapsOf, onePerTitle, seasonsOf, SERIES } from "./fakeSeasons.mjs";

export function createVigie({ snapshot, listOf, clean, poster, note, json, clock }) {
  const mode = { vigie: "on", scenario: "live", demandes: "off" };
  /** Les demandes faites au banc (`POST titles/request`, `/__request`) : jamais relayées. */
  const made = [];

  /* La saga de « L'Attaque des titans : La dernière attaque » (l'instantané en
   * a la réponse, pas les affiches : relevées sur la page publique de TMDB). Deux
   * de ses volets sont des demandes du compte : l'une avance, l'autre attend. */
  const SAGA_POSTERS = {
    379088: "/8dAzRcrzSqRd5FjLNJ7Bw92Kod4.jpg",
    330081: "/z7UVitlWT3m1hTCbV6kwxPJmGcx.jpg",
    492999: "/lJ9HfT2paZIyXMFDRupIB2EA5QD.jpg",
    714194: "/kXUSsxQ2J3QVGkG1thmhI1FadKd.jpg",
    1333100: "/2wyvGVSCK69uwtUD0Sn82cD2WdH.jpg",
  };
  const tmdbPoster = (tmdbId) => `https://image.tmdb.org/t/p/w342${SAGA_POSTERS[tmdbId]}`;
  function sagaOf(collectionId) {
    const found = Object.values(snapshot.detail ?? {}).find((d) => d.saga?.collectionId === collectionId)?.saga;
    if (!found?.saga) return null;
    return { ...found, saga: { ...found.saga, parts: found.saga.parts.map((p) => ({ ...p, posterPath: SAGA_POSTERS[p.tmdbId] ?? null })) } };
  }
  const sagaTitle = (tmdbId, n) => {
    const part = sagaOf(383987)?.saga.parts.find((p) => p.tmdbId === tmdbId);
    return { key: `movie:${tmdbId}`, title: part?.title ?? `Volet ${n}`, year: part?.releaseDate ? Number(part.releaseDate.slice(0, 4)) : null, imageUrl: tmdbPoster(tmdbId), seasons: null };
  };
  function title(kind, index, n) {
    const item = listOf(kind)[index];
    const mediaType = kind === "movies" ? "movie" : "tv";
    return { key: `${mediaType}:${9500 + n}`, title: clean(item?.Name), year: item?.ProductionYear ?? null, imageUrl: item ? poster(item.Id) : null, seasons: mediaType === "tv" ? [2] : null };
  }

  /** Un titre qui arrive : de `from` % à 100 en `routeS` s, puis `importS` s en mise en bibliothèque, puis `awayS` s sorti (arrivé), et ça repart. */
  function lifecycle(base, { from, routeS, importS = 12, awayS = 15 }, elapsedS) {
    const e = elapsedS % (routeS + importS + awayS);
    if (e < routeS) {
      const percent = from + ((100 - from) * e) / routeS;
      return { ...base, state: "arriving", percent: Math.round(percent * 10) / 10, etaSeconds: Math.max(1, Math.round(routeS - e)) };
    }
    if (e < routeS + importS) return { ...base, state: "importing", percent: null, etaSeconds: null };
    return null;
  }

  const TV = "tv";
  const ELSEWHERE = null;

  /** Une demande du banc : en attente 8 s, en route 60 s (de 0 à 100 %), 10 s en mise en bibliothèque, puis arrivée. */
  function madeNow(entry) {
    const e = (Date.now() - entry.at) / 1000;
    const base = { key: entry.key, title: entry.title, year: entry.year, imageUrl: entry.imageUrl, seasons: entry.seasons, origin: entry.origin };
    if (e < 8) return { ...base, state: "pending", percent: null, etaSeconds: null };
    if (e < 68) return { ...base, state: "arriving", percent: Math.round(((e - 8) / 60) * 1000) / 10, etaSeconds: Math.max(1, Math.round(68 - e)) };
    if (e < 78) return { ...base, state: "importing", percent: null, etaSeconds: null };
    return null;
  }

  /** Les titres attendus du COMPTE, chacun avec l'origine de sa demande (« tv », ou d'ailleurs). */
  function mine() {
    const elapsedS = (Date.now() - clock.t0) / 1000;
    const fromBench = made.map(madeNow).filter(Boolean);
    const still = [
      { ...title("movies", 1, 3), state: "pending", percent: null, etaSeconds: null, origin: TV },
      { ...title("movies", 6, 4), state: "blocked", percent: null, etaSeconds: null, origin: ELSEWHERE },
    ];
    if (mode.scenario === "empty") return fromBench;
    if (mode.scenario === "still") return [...fromBench, ...still];
    return [
      ...fromBench,
      lifecycle({ ...title("movies", 5, 1), origin: TV }, { from: 18, routeS: 120 }, elapsedS),
      lifecycle({ ...title("series", 3, 2), origin: ELSEWHERE }, { from: 62, routeS: 400 }, elapsedS),
      lifecycle({ ...sagaTitle(379088, 1), origin: TV }, { from: 30, routeS: 90 }, elapsedS),
      { ...sagaTitle(330081, 2), state: "pending", percent: null, etaSeconds: null, origin: ELSEWHERE },
      ...still,
    ].filter(Boolean);
  }

  /** `mine` comme le vrai : filtrée par `origin` s'il est donné (Vigie ≥ 1.22) AVANT de ranger par titre, sans dire d'où vient chaque titre. */
  function mineFor(url) {
    const origin = mode.vigie === "noorigin" ? null : url.searchParams.get("origin");
    const items = origin === null ? mine() : mine().filter((t) => t.origin === origin);
    return onePerTitle(items).map(({ origin: _origin, ...item }) => item);
  }

  /** Ce que le banc sait d'un titre demandé : un volet de la saga, un titre de l'instantané, sinon un nom de banc. */
  function describe(key) {
    const [mediaType, id] = key.split(":");
    const part = sagaOf(383987)?.saga.parts.find((p) => p.tmdbId === Number(id));
    if (part) return sagaTitle(part.tmdbId, 0);
    const local = Object.values(snapshot.items).map((entry) => entry.item)
      .find((item) => item?.ProviderIds?.Tmdb === id && (item.Type === "Series") === (mediaType === "tv"));
    if (local) return { key, title: clean(local.Name), year: local.ProductionYear ?? null, imageUrl: poster(local.Id), seasons: null };
    return { key, title: `Titre ${id}`, year: null, imageUrl: null, seasons: mediaType === "tv" ? [1] : null };
  }

  /** Les saisons d'une série que le compte a demandées au banc (toutes origines). */
  const requestedSeasons = (key) => new Set(made.filter((m) => m.key === key).flatMap((m) => m.seasons ?? []));

  /** Une demande de plus : un film une fois ; une série, pour des saisons qu'elle n'a pas encore demandées. */
  function remember(key, origin, platform, seasons) {
    let fresh = seasons;
    if (seasons) {
      const known = requestedSeasons(key);
      fresh = seasons.filter((n) => !known.has(n));
      if (fresh.length === 0) return false;
    } else if (made.some((m) => m.key === key)) return false;
    made.unshift({ ...describe(key), ...(fresh ? { seasons: fresh } : {}), origin, platform, at: Date.now() });
    note(`[demande] ${key} origine=${origin ?? "ailleurs"} plateforme=${platform ?? "-"}${fresh ? ` saisons=${fresh.join(",")}` : ""}`);
    return true;
  }

  function readBody(req) {
    return new Promise((resolve) => {
      let raw = "";
      req.on("data", (chunk) => { raw += chunk; });
      req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
    });
  }

  /** L'état d'un titre absent : demandé (par le compte ou le banc), ou offert à la demande (`demandes=on`). */
  function stateFor(key) {
    if (mine().some((t) => t.key === key)) return { badge: { label: "Demandé", tone: "info" }, request: null };
    if (mode.demandes !== "on") return null;
    return key.startsWith("movie:")
      ? { badge: null, request: { mode: "direct", label: "Demander" } }
      : { badge: null, request: { mode: "open", label: "Choisir les saisons", href: `/seer/tv/${key.slice(3)}` } };
  }

  const TITLES = { state: "/titles/state", request: "/titles/request", access: "/titles/access", mine: "/titles/mine", seasons: "/titles/seasons", gaps: "/titles/gaps" };

  function activePlugins() {
    if (mode.vigie === "off") return [];
    const titles = mode.vigie === "old" ? { state: TITLES.state, request: TITLES.request } : TITLES;
    return [{ pluginId: "seer", name: "Vigie", configEnabled: true, titles }];
  }

  async function vigie(req, res, route, url) {
    note(`[vigie] ${req.method} ${route}${url.search}`);
    if (route === TITLES.access) return json(res, 200, { request: mode.vigie !== "blocked" });
    if (route === TITLES.mine) return json(res, 200, { items: mineFor(url) });
    if (route === TITLES.state) {
      const items = {};
      for (const key of (url.searchParams.get("keys") ?? "").split(",").filter(Boolean)) {
        const state = stateFor(key);
        if (state) items[key] = state;
      }
      return json(res, 200, { items });
    }
    if (route === TITLES.seasons) {
      const key = url.searchParams.get("key") ?? "";
      return json(res, 200, { seasons: seasonsOf(key, requestedSeasons(key)) });
    }
    if (route === TITLES.gaps) {
      const items = {};
      for (const key of (url.searchParams.get("keys") ?? "").split(",").filter((k) => SERIES[k])) {
        items[key] = { seasons: gapsOf(key, requestedSeasons(key)) };
      }
      return json(res, 200, { items });
    }
    if (route === TITLES.request) {
      const body = await readBody(req);
      note(`[vigie] corps ${JSON.stringify(body)}`);
      if (mode.demandes !== "on") return json(res, 200, { ok: false, message: "Banc : aucune demande ne part." });
      const key = `${body.mediaType}:${body.tmdbId}`;
      // Comme Vigie : l'origine n'est gardée que lisible, et un Vigie d'avant l'ignore.
      const origin = mode.vigie !== "noorigin" && typeof body.origin === "string" && /^[a-z][a-z0-9-]{0,15}$/.test(body.origin) ? body.origin : null;
      const platform = origin && typeof body.platform === "string" ? body.platform : null;
      const seasons = Array.isArray(body.seasons) ? body.seasons : null;
      if (!remember(key, origin, platform, seasons)) {
        return json(res, 200, { ok: false, message: "Déjà demandé.", state: stateFor(key) });
      }
      return json(res, 200, { ok: true, message: "Demande envoyée.", state: { badge: { label: "Demandé", tone: "info" }, request: null } });
    }
    return json(res, 404, {});
  }

  /** Les routes de contrôle du faux Vigie ; `true` si la requête en était une. */
  function control(p, url, res) {
    if (p === "/__request") {
      const key = url.searchParams.get("key") ?? "";
      if (!/^(movie|tv):\d+$/.test(key)) return json(res, 400, { error: "key=movie:<id>" }), true;
      const origin = url.searchParams.get("origin") === "tv" ? TV : ELSEWHERE;
      const seasons = url.searchParams.get("seasons")?.split(",").map(Number).filter(Number.isInteger) ?? null;
      json(res, 200, { added: remember(key, origin, origin ? "banc" : null, seasons), made: made.length });
      return true;
    }
    if (p === "/__mine") return json(res, 200, { all: mine(), tv: mine().filter((t) => t.origin === TV) }), true;
    return false;
  }

  return { mode, made, sagaOf, activePlugins, handle: vigie, control };
}
