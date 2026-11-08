// FAUX natif, pour essayer le shim dans un Chrome ordinaire (DevTools / CDP) tant que
// le socle et vidéo-HDR ne sont pas intégrés. Il pose `window.__shell` (forme du socle,
// docs/INTERFACES.md) et répond aux canaux `tentacle:*` comme le fera src/bridge/ —
// c'est aussi la SPÉCIFICATION exécutable des réponses natives :
//   - évènements `mpv://event` { event, reason?, error? } (raisons numériques),
//   - `mpv://property-change` { name, data, id, at } pour les propriétés observées,
//   - `keep-open=yes` : en fin de fichier, `eof-reached` vrai et pause, pas d'`end-file`.
// Aucune vidéo n'est décodée : l'horloge avance seule. Journal : `window.__fakeLog`.
// Jamais livré : seul `web/shim/dev/run-chrome.mjs` l'injecte.
(function installFakeShell() {
  "use strict";
  if (window.top !== window) return;
  const log = (window.__fakeLog = []);
  const listeners = new Map();
  const emit = (event, payload) => {
    log.push({ t: Date.now(), dir: "evt", event, payload });
    for (const cb of listeners.get(event) ?? []) setTimeout(() => cb(payload), 0);
  };

  // L'état de « mpv ». Pistes du film de contrôle du banc (Banc Pistes SDR).
  const DURATION = 120;
  const TRACKS = [
    { id: 1, type: "video", codec: "h264", selected: true, default: true },
    { id: 1, type: "audio", lang: "fra", title: "Français", codec: "aac", default: true },
    { id: 2, type: "audio", lang: "eng", title: "English", codec: "aac" },
    { id: 1, type: "sub", lang: "fra", codec: "subrip" },
    { id: 2, type: "sub", lang: "eng", codec: "subrip" },
  ];
  let mpv = null;
  let fullscreen = false;

  function newMpv(observed) {
    return {
      observed: new Map(observed.map(([name], i) => [name, i + 1])),
      props: { pause: false, "time-pos": null, duration: null, volume: 100, mute: false, aid: 1, sid: 0,
        speed: 1, "eof-reached": false, seeking: false, "paused-for-cache": false, "sub-visibility": true },
      start: 0, tracks: TRACKS.map((t) => ({ ...t })), timer: null, loaded: false,
    };
  }

  function setProp(name, value) {
    if (!mpv) return;
    mpv.props[name] = value;
    const id = mpv.observed.get(name);
    if (id !== undefined) emit("tentacle:mpv://property-change", { name, data: value, id, at: Date.now() });
    if (name === "aid" || name === "sid") {
      const type = name === "aid" ? "audio" : "sub";
      for (const t of mpv.tracks) if (t.type === type) t.selected = t.id === value;
    }
  }

  function tick() {
    if (!mpv || !mpv.loaded || mpv.props.pause) return;
    const pos = Math.min(DURATION, (mpv.props["time-pos"] ?? 0) + 0.125 * mpv.props.speed);
    setProp("time-pos", pos);
    setProp("audio-pts", pos);
    if (pos >= DURATION) {
      setProp("eof-reached", true);
      setProp("pause", true);
    }
  }

  async function loadfile(url) {
    mpv.loaded = false;
    clearInterval(mpv.timer);
    emit("tentacle:mpv://event", { event: "start-file" });
    // Comme mpv : une source injoignable finit en `end-file` ERROR (4), LOADING_FAILED (-13).
    const ok = await fetch(url, { method: "HEAD" }).then((r) => r.ok, () => false);
    if (!mpv) return;
    if (!ok) {
      emit("tentacle:mpv://event", { event: "end-file", reason: 4, error: -13 });
      emit("tentacle:mpv://event", { event: "idle" });
      return;
    }
    setProp("eof-reached", false);
    setTimeout(() => {
      if (!mpv) return;
      mpv.loaded = true;
      emit("tentacle:mpv://event", { event: "file-loaded" });
      setProp("duration", DURATION);
      setProp("time-pos", mpv.start);
      setProp("aid", mpv.props.aid || 1);
      setProp("sid", mpv.props.sid || false);
      setProp("hwdec-current", "videotoolbox");
      // Le front retient la lecture tant que le cache est court (`useMpvPrebuffer`) : un vrai
      // mpv remplit son cache ; ici il est plein d'emblée.
      setProp("demuxer-cache-duration", 30);
      setProp("paused-for-cache", false);
      emit("tentacle:mpv://event", { event: "video-reconfig" });
      emit("tentacle:mpv://event", { event: "playback-restart" });
      setProp("pause", false);
      mpv.timer = setInterval(tick, 125);
    }, 300);
  }

  function seek(value, mode) {
    const base = mode === "relative" ? (mpv.props["time-pos"] ?? 0) : 0;
    setProp("seeking", true);
    setTimeout(() => {
      if (!mpv) return;
      const pos = Math.max(0, Math.min(DURATION, base + Number(value)));
      setProp("time-pos", pos);
      // keep-open=yes : un seek au bout s'arrête sur la dernière image, en pause.
      setProp("eof-reached", pos >= DURATION);
      if (pos >= DURATION) setProp("pause", true);
      setProp("seeking", false);
      emit("tentacle:mpv://event", { event: "playback-restart" });
    }, 80);
  }

  function trackProp(path) {
    const m = /^track-list\/(?:count|(\d+)\/(\w+))$/.exec(path);
    if (!m) return undefined;
    if (m[1] === undefined) return mpv.tracks.length;
    const t = mpv.tracks[Number(m[1])];
    if (!t) return null;
    const v = t[m[2]];
    return v === undefined ? (["selected", "forced", "default", "external"].includes(m[2]) ? false : null) : v;
  }

  const handlers = {
    mpv_init({ options }) {
      if (mpv) handlers.mpv_destroy();
      mpv = newMpv(options?.observedProperties ?? []);
      return "ok";
    },
    mpv_destroy() {
      if (!mpv) return null;
      clearInterval(mpv.timer);
      emit("tentacle:mpv://event", { event: "end-file", reason: 2, error: 0 });
      emit("tentacle:mpv://event", { event: "shutdown" });
      mpv = null;
      return null;
    },
    mpv_command({ name, args = [] }) {
      if (!mpv) throw { code: "no_player", message: `${name} : mpv non initialisé` };
      const a = args.map(String);
      if (name === "loadfile") return loadfile(a[0]), null;
      if (name === "seek") return seek(a[0], a[1] ?? "relative"), null;
      if (name === "cycle" && a[0] === "pause") return setProp("pause", !mpv.props.pause), null;
      if (name === "stop") return handlers.mpv_destroy(), null;
      if (name === "sub-add") {
        const id = Math.max(...mpv.tracks.filter((t) => t.type === "sub").map((t) => t.id)) + 1;
        mpv.tracks.push({ id, type: "sub", external: true, title: "externe" });
        if (a[1] === "select") setProp("sid", id);
        return null;
      }
      if (name === "set") {
        if (a[0] === "start") return (mpv.start = a[1] === "none" ? 0 : Number(a[1].replace("+", ""))), null;
        const v = a[1] === "no" ? false : Number.isFinite(Number(a[1])) ? Number(a[1]) : a[1];
        return setProp(a[0], v), null;
      }
      throw { code: "refused", message: `${name} : commande refusée` };
    },
    mpv_set_property({ name, value }) {
      if (!mpv) throw { code: "no_player", message: `${name} : mpv non initialisé` };
      return setProp(name, value), null;
    },
    mpv_get_property({ name }) {
      if (!mpv) return null;
      const track = trackProp(name);
      if (track !== undefined) return track;
      return mpv.props[name] ?? null;
    },
    toggle_fullscreen() {
      fullscreen = !fullscreen;
      emit("tentacle:window://fullscreen", fullscreen);
      return fullscreen;
    },
    player_fullscreen_enter: () => fullscreen,
    // macOS (comme Electron et src/bridge/window_channels.cpp) : la fenêtre reste telle quelle.
    player_fullscreen_leave: () => null,
    player_surface_transparent: () => null,  // comme le natif : la page est toujours composée en transparence
    prevent_display_sleep_start: () => null,
    prevent_display_sleep_stop: () => null,
  };

  window.__fakeCommands = Object.keys(handlers);
  window.__shell = {
    invoke(channel, payload) {
      log.push({ t: Date.now(), dir: "inv", channel, payload });
      const name = channel.replace(/^tentacle:/, "");
      const h = handlers[name];
      if (!h) return Promise.reject({ code: "no_handler", message: `aucun gestionnaire : ${channel}` });
      try {
        return Promise.resolve(h(payload ?? {}));
      } catch (e) {
        log.push({ t: Date.now(), dir: "err", channel, error: e });
        return Promise.reject(e);
      }
    },
    on(event, cb) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(cb);
      return () => listeners.get(event)?.delete(cb);
    },
  };
})();
