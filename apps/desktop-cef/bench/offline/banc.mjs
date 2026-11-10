// Banc des transferts de Tentacle CEF, contre le banc local (jamais un autre serveur) :
// film (pause, reprise, coupure du relais puis relance seule), épisodes (dont un Allégé),
// album (titres en parallèle), listes, rapports de lecture, purge.
//   node relay.mjs 34711 3471 4000000 &   # le relais bridé que le banc coupe
//   node banc.mjs transferts|apres-relance
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { connect, events, invoke, jellyfin, listenEvents, relay, session, sleep, until } from "./page.mjs";

const RELAY = "http://127.0.0.1:34711";
const FILM = "396cbeaaee75ad7d8f52b0002c4087aa"; // Banc Pistes SDR, 40 Mo
const EPISODES = ["00b0d69c8fd6a636dfecce183412e89f", "499e5cdbf3b507b3e6903ec0f9c33bc2"];
const ALBUM = "Sinus FLAC";
const mode = process.argv[2] ?? "transferts";
const cdp = await connect();
const s = await session(cdp);
const log = (...a) => console.log(...a);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16);
const state = async (itemId) => (await invoke(cdp, "downloads_state_for_item", { userId: s.userId, itemId })).ok;

async function item(id, variant = "original", preset = null) {
  const dto = await jellyfin(cdp, `/Users/${s.userId}/Items/${id}?Fields=MediaSources`);
  const ms = dto.MediaSources[0];
  return {
    itemId: dto.Id, mediaSourceId: ms.Id, variant, preset, containerExt: ms.Container,
    expectedSize: variant === "original" ? ms.Size : null,
    estimatedSize: variant === "light" ? Math.round((dto.RunTimeTicks / 1e7) * ((1_500_000 + 128_000) / 8) * 1.15) : null,
    kind: dto.Type === "Episode" ? "episode" : "movie", seriesId: dto.SeriesId ?? null, seasonId: dto.SeasonId ?? null,
    libraryId: null, runtimeTicks: dto.RunTimeTicks ?? null, title: dto.Name, seriesName: dto.SeriesName ?? null,
    indexNumber: dto.IndexNumber ?? null, parentIndexNumber: dto.ParentIndexNumber ?? null,
    autoDeleteAfterWatch: false, autoDeleteDelayMinutes: 0, audioStreamIndex: null, burnSubtitleIndex: null, subtitles: null,
  };
}

async function transfers() {
  await listenEvents(cdp);
  log("relais", await relay("state"));
  log("engine_start", JSON.stringify(await invoke(cdp, "downloads_engine_start", { serverUrl: RELAY, token: s.token })));
  // --- Film : pause, reprise, coupure -----------------------------------------------------
  const film = await item(FILM);
  const enq = await invoke(cdp, "downloads_enqueue", { userId: s.userId, serverUrl: RELAY, token: s.token, items: [film] });
  log("film en file", JSON.stringify(enq.ok));
  await until(async () => ((await state(FILM))?.bytesDone ?? 0) > 8e6, 60000, "8 Mo reçus");
  const fileId = (await state(FILM)).id;
  await invoke(cdp, "downloads_pause", { fileId });
  const paused = await until(async () => ((st) => (st.status === "paused" ? st : null))(await state(FILM)), 10000, "pause");
  log("pause :", paused.status, "pausedByUser", paused.pausedByUser, "octets", paused.bytesDone);
  await sleep(1500);
  const still = await state(FILM);
  log("toujours en pause après 1,5 s :", still.status, still.bytesDone === paused.bytesDone ? "(rien ne bouge)" : "(A BOUGÉ)");
  await invoke(cdp, "downloads_resume", { fileId });
  await until(async () => ((await state(FILM))?.bytesDone ?? 0) > paused.bytesDone + 8e6, 60000, "reprise");
  const before = (await state(FILM)).bytesDone;
  log("reprise : reprend à", paused.bytesDone, "→", before, "(par plage : rien n'est retéléchargé)");
  log("coupure du relais :", await relay("cut"));
  const cut = await until(async () => ((st) => (st.status === "paused" ? st : null))(await state(FILM)), 20000, "coupure");
  log("après coupure :", cut.status, "pausedByUser", cut.pausedByUser, "relance dans", cut.nextRetryAt - Date.now(), "ms");
  await sleep(1000);
  log("rétablissement :", await relay("restore"));
  const done = await until(async () => ((st) => (st.status === "complete" ? st : null))(await state(FILM)), 120000, "film complet");
  log("film :", done.status, done.bytesDone, "/", done.expectedSize, "tentatives", done.retryCount);
  // --- Épisodes : un Original, un Allégé (transcodage du serveur) -------------------------
  const batch = [await item(EPISODES[0]), await item(EPISODES[1], "light", "p480")];
  log("saison en file", JSON.stringify((await invoke(cdp, "downloads_enqueue", { userId: s.userId, serverUrl: RELAY, token: s.token, items: batch })).ok));
  for (const id of EPISODES) {
    const st = await until(async () => ((x) => (x && ["complete", "error"].includes(x.status) ? x : null))(await state(id)), 240000, id);
    log("épisode", id.slice(0, 6), st.variant, st.status, st.bytesDone, st.errorCode ?? "");
  }
  // --- Album : trois titres à la fois -----------------------------------------------------
  const tracks = await jellyfin(cdp, `/Users/${s.userId}/Items?Recursive=true&IncludeItemTypes=Audio&Fields=MediaSources`);
  const album = tracks.Items.filter((t) => t.Album === ALBUM);
  const plan = await (await fetch(`${s.server}/api/music/offline/plan`, {
    method: "POST", headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: album.map((t) => t.Id) }),
  })).json().catch(() => null);
  const planOf = (id) => (plan?.tracks ?? plan?.items ?? []).find?.((p) => p.id === id || p.itemId === id) ?? null;
  const items = album.map((t) => {
    const p = planOf(t.Id);
    return {
      trackKey: `jf:${t.Id}`, origin: "library",
      sourcePath: p?.path ?? `/api/downloads/original/${t.Id}?mediaSourceId=${t.MediaSources[0].Id}`,
      variant: p?.variant ?? "original", preset: p?.preset ?? null, containerExt: p?.container ?? t.MediaSources[0].Container,
      expectedSize: p ? p.expectedSize : t.MediaSources[0].Size, estimatedSize: p?.estimatedSize ?? null,
      title: t.Name, artist: (t.Artists ?? []).join(", ") || null, album: t.Album, albumKey: `jf:${t.AlbumId}`,
      discNumber: t.ParentIndexNumber ?? null, trackNumber: t.IndexNumber ?? null, durationMs: Math.round((t.RunTimeTicks ?? 0) / 1e4),
      artworkPath: `/api/jellyfin/Items/${t.AlbumId}/Images/Primary`, trackJson: JSON.stringify({ key: `jf:${t.Id}`, title: t.Name }),
    };
  });
  log("plan du serveur :", plan ? "lu" : "absent (repli sur l'original)");
  const collection = { key: `album:jf:${album[0].AlbumId}`, kind: "album", title: ALBUM, subtitle: null, coverItemId: album[0].AlbumId,
    trackKeys: items.map((i) => i.trackKey) };
  log("album en file", JSON.stringify((await invoke(cdp, "downloads_music_enqueue", { userId: s.userId, serverUrl: RELAY, token: s.token, items, collection })).ok));
  let maxParallel = 0;
  const kept = await until(async () => {
    const l = (await invoke(cdp, "downloads_music_list", { userId: s.userId })).ok;
    maxParallel = Math.max(maxParallel, l.tracks.filter((t) => t.status === "downloading").length);
    return l.tracks.length === items.length && l.tracks.every((t) => t.status === "complete") ? l : null;
  }, 120000, "album");
  log("album :", kept.tracks.length, "titres complets, au plus", maxParallel, "en même temps ; pochettes",
      kept.tracks.filter((t) => t.coverRel).length, "; collections", kept.collections.length);
  const ev = await events(cdp);
  log("évènements reçus : progress", ev.progress.length, "changed", ev.changed);
}

async function afterRelaunch() {
  const list = (await invoke(cdp, "downloads_list", { userId: s.userId })).ok;
  log("liste :", list.map((e) => `${e.itemId.slice(0, 6)}:${e.variant}:${e.status}:${e.bytesDone}`).join(" "));
  const music = (await invoke(cdp, "downloads_music_list", { userId: s.userId })).ok;
  log("musique :", music.tracks.map((t) => `${t.title}:${t.status}`).join(", "), "| collections", music.collections.length);
  const src = (await invoke(cdp, "downloads_local_source", { userId: s.userId, itemId: FILM })).ok;
  log("source locale du film :", src?.absolutePath, "sha", src ? sha(src.absolutePath) : "-");
  log("occupation :", (await invoke(cdp, "downloads_disk_usage")).ok, "octets");
}

if (mode === "transferts") await transfers();
else await afterRelaunch();
cdp.close();
