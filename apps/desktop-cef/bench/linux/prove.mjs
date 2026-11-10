#!/usr/bin/env node
// Preuves de l'axe linux, par les DevTools de l'app du conteneur (bench/linux/run.sh up …),
// relayés au Mac sur 127.0.0.1:9427. N'imprime que des faits relus (aucun secret).
//   node bench/linux/prove.mjs state                 session, pont, compositeur, statistiques
//   node bench/linux/prove.mjs page <fichier.png>    capture de la PAGE (CDP)
//   node bench/linux/prove.mjs login [admin|user]    connexion au banc par le formulaire du front
//   node bench/linux/prove.mjs video <chemin>        mpv_init + loadfile, puis ce que mpv rend
//   node bench/linux/prove.mjs fullscreen            plein écran, état, retour
//   node bench/linux/prove.mjs octave <chemin>       moteur audio d'Octave (ao=null imposé)
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.PONT_CDP_PORT ??= "9427";
const here = dirname(fileURLToPath(import.meta.url));
const { Cdp, pageTarget } = await import(join(here, "../../web/shim/dev/cdp.mjs"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cdp = await Cdp.connect((await pageTarget()).webSocketDebuggerUrl);
const show = (label, v) => console.log(`${label} : ${typeof v === "string" ? v : JSON.stringify(v)}`);
const invoke = (ch, payload = {}) =>
  cdp.eval(`window.tentacle.invoke(${JSON.stringify(ch)}, ${JSON.stringify(payload)}).catch((e) => ({ erreur: String(e && (e.code || e.message) || e) }))`);
const shell = (ch, payload = {}) => cdp.eval(`window.__shell.invoke(${JSON.stringify(ch)}, ${JSON.stringify(payload)})`);
const mpvProps = async (names) => {
  const out = {};
  for (const n of names) out[n] = await invoke("mpv_get_property", { name: n, format: "string" });
  return out;
};

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === "state") {
    show("page", await cdp.eval("location.href"));
    show("pont", await cdp.eval(`({ platform: window.tentacle?.platform, montage: window.tentacle?.montage ?? null,
      fenetrage: window.tentacle?.fenetrage ?? null, version: window.tentacle?.version,
      commandes: window.tentacle?.capabilities?.length, linux: window.tentacle?.capabilities?.filter((c) => c.startsWith("linux_")) })`));
    show("linux_session_get", await invoke("linux_session_get"));
    show("langues", await cdp.eval("navigator.languages"));
    show("couches", await shell("shell.debug.layers"));
    const s = await shell("shell.stats");
    show("stats", { viewFrames: s.viewFrames, presentedFrames: s.presentedFrames, presentedFps: s.presentedFps,
      width: s.width, height: s.height, scale: s.scale, refreshRate: s.refreshRate, lastCopyMs: s.lastCopyMs });
    show("fenêtre", await shell("shell.window.state"));
  } else if (cmd === "page") {
    const r = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(arg, Buffer.from(r.data, "base64"));
    show("capture de la page", arg);
  } else if (cmd === "login") {
    const r = spawnSync(process.execPath, [join(here, "../../web/shim/dev/login.mjs"), arg ?? "admin"], { stdio: "inherit" });
    process.exitCode = r.status ?? 1;
  } else if (cmd === "video") {
    show("mpv_init", await invoke("mpv_init", { options: { initialOptions: {}, observedProperties: [["time-pos", "double"]] } }));
    show("loadfile", await invoke("mpv_command", { name: "loadfile", args: [arg] }));
    await sleep(6000);
    show("mpv", await mpvProps(["current-vo", "current-gpu-context", "vo-configured", "video-params/w", "video-params/h",
      "video-params/gamma", "video-target-params/gamma", "video-target-params/primaries", "estimated-frame-number",
      "frame-drop-count", "time-pos", "hwdec-current", "current-ao"]));
    await sleep(2000);
    show("images (2 s plus tard)", await invoke("mpv_get_property", { name: "estimated-frame-number", format: "string" }));
    show("couches", await shell("shell.debug.layers"));
    show("surface", await invoke("video_surface_probe"));
  } else if (cmd === "video-stop") {
    show("mpv_destroy", await invoke("mpv_destroy"));
    await sleep(1000);
    show("couches", await shell("shell.debug.layers"));
  } else if (cmd === "fullscreen") {
    show("avant", await shell("shell.window.state"));
    await shell("shell.window.setFullscreen", { on: true });
    await sleep(1500);
    show("plein écran", await shell("shell.window.state"));
    const s = await shell("shell.stats");
    show("taille vue par la page", { width: s.width, height: s.height, viewFrames: s.viewFrames });
    if (arg !== "garder") {
      await shell("shell.window.setFullscreen", { on: false });
      await sleep(1500);
      show("après", await shell("shell.window.state"));
    }
  } else if (cmd === "octave") {
    show("audio_engine_start", await invoke("audio_engine_start", {}));
    show("audio_play", await invoke("audio_play", { track: { trackKey: "banc-linux" }, source: { url: arg } }));
    await sleep(4000);
    show("audio_control état", await invoke("audio_control", { action: "state" }));
    show("audio_engine_stop", await invoke("audio_engine_stop", {}));
  } else {
    console.error("usage : prove.mjs state | page <png> | login [admin|user] | video <chemin> | video-stop | fullscreen [garder] | octave <chemin>");
    process.exitCode = 2;
  }
} finally {
  cdp.close?.();
}
