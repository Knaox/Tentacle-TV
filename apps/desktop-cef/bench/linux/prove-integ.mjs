#!/usr/bin/env node
// Preuves de l'arbre INTÉGRÉ sous Linux (lot cef-parite), sur l'app du conteneur
// (bench/linux/run.sh up sway|x11), par ses DevTools relayés sur 127.0.0.1:9427 :
//   node bench/linux/prove-integ.mjs kept [n]   relire le n-ième titre gardé (hors ligne)
//   node bench/linux/prove-integ.mjs dialog     deux confirm() : boîte GTK, Échap puis Entrée
//   node bench/linux/prove-integ.mjs mpris      fiche MPRIS lue par gdbus, commandes du bus
// Garder un album d'abord : relais `bench/offline/relay.mjs` dans le conteneur, puis
// `HORSLIGNE_CDP_PORT=9427 node bench/offline/banc.mjs album`.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.PONT_CDP_PORT ??= "9427";
const here = dirname(fileURLToPath(import.meta.url));
const { Cdp, pageTarget } = await import(join(here, "../../web/shim/dev/cdp.mjs"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const container = process.env.BANC_LINUX_NAME ?? "tentacle-cef-linux";
const show = (label, v) => console.log(`${label} : ${typeof v === "string" ? v : JSON.stringify(v)}`);

// Dans le conteneur : l'environnement graphique du banc et le bus de session de l'app.
const inside = (script) => {
  const env = `export XDG_RUNTIME_DIR=/tmp/xdg WAYLAND_DISPLAY=$(cat /tmp/banc/wayland) DISPLAY=:99;
    P=$(pgrep -f "app/tentacle --url" | head -1);
    export $(tr "\\0" "\\n" < /proc/$P/environ | grep ^DBUS_SESSION_BUS_ADDRESS=);
    COMP=$(cat /tmp/banc/compositor); SWAYSOCK=$(ls /tmp/xdg/sway-ipc.* 2>/dev/null | head -1); export SWAYSOCK;`;
  const r = spawnSync("docker", ["exec", container, "bash", "-c", env + script], { encoding: "utf8" });
  return (r.stdout + r.stderr).trim();
};
// Une touche à la fenêtre au focus. wtype : un clavier virtuel NEUF à chaque appel, dont
// la table ne porte que ses touches — GDK traduit Échap seul par une table vide (mesuré :
// la boîte ne répond pas) ; suivie d'une touche neutre, et après 1,5 s pour que le client
// ait lié le clavier, elle passe. xdotool (X11) n'a pas ce travers.
const key = (k) =>
  inside(`if [ "$COMP" = x11 ]; then xdotool key ${k}; else
    swaymsg "[app_id=tentacle] focus" >/dev/null 2>&1; timeout 8 wtype -s 1500 -k ${k} -s 300 -k Shift_L; fi`);

const cdp = await Cdp.connect((await pageTarget()).webSocketDebuggerUrl);
const session = `const u = JSON.parse(localStorage.getItem('tentacle_user'));
  const server = localStorage.getItem('tentacle_server_url');
  const list = await window.tentacle.invoke('downloads_music_list', { userId: u.Id });`;
const playKept = (n, withMeta) => `${session}
  const tr = list.tracks[${n}];
  await window.tentacle.invoke('audio_engine_start', { serverOrigin: new URL(server).origin, volume: 1, muted: false });
  await window.tentacle.invoke('audio_play', { startMs: 0,
    track: { trackKey: tr.trackKey${withMeta ? ", meta: { title: tr.title, artist: tr.artist, album: tr.album }" : ""} },
    source: { url: server + '/api/music/stream/' + tr.itemId, kept: { userId: u.Id, trackKey: tr.trackKey } } });`;
const prop = (name) => `window.__shell.invoke('octave.debug.prop', { name: '${name}' })`;

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === "kept") {
    const n = Number(arg ?? 0);
    show("gardés", await cdp.eval(`(async () => { ${session} return list.tracks.map((t) => t.title + ' (' + t.status + ')'); })()`));
    show("relecture", await cdp.eval(`(async () => { ${playKept(n, false)}
      await new Promise((r) => setTimeout(r, 3000));
      const out = { titre: tr.title, path: await ${prop("path")}, ao: await ${prop("current-ao")}, pos: await ${prop("time-pos")} };
      await window.tentacle.invoke('audio_engine_stop', {}); return out; })()`));
  } else if (cmd === "dialog") {
    await cdp.eval(`(() => { window.__reponses = []; const next = (n) => { if (n > 2) return;
      setTimeout(() => { window.__reponses.push(confirm('Banc Linux ' + n)); next(n + 1); }, 100); }; next(1); return true; })()`);
    await sleep(2500);
    show("boîte au focus", inside(`if [ "$COMP" = x11 ]; then W=$(xdotool getactivewindow);
      xprop -id $W WM_CLASS _NET_WM_WINDOW_TYPE WM_TRANSIENT_FOR | tr "\\n" " "; else
      swaymsg -t get_tree | python3 -c "import json,sys
def w(n):
  if n.get('app_id') == 'tentacle': print(n['type'], 'au focus' if n.get('focused') else 'sans focus')
  [w(c) for c in n.get('nodes', []) + n.get('floating_nodes', [])]
w(json.load(sys.stdin))"; fi`));
    key("Escape");
    await sleep(2500);
    key("Return");
    await sleep(1500);
    show("réponses de la page (Échap, Entrée)", await cdp.eval("JSON.stringify(window.__reponses)"));
  } else if (cmd === "mpris") {
    await cdp.eval(`(async () => { ${playKept(0, true)}
      window.__remote = []; if (!window.__remoteHooked) { window.__remoteHooked = true;
        window.tentacle.on('audio://event', (e) => { if (e && e.type === 'remote') window.__remote.push(e.command); }); }
      return true; })()`);
    await sleep(1500);
    const d = "gdbus call --session --dest org.mpris.MediaPlayer2.tentacle --object-path /org/mpris/MediaPlayer2";
    show("gdbus Identity", inside(`${d} --method org.freedesktop.DBus.Properties.Get org.mpris.MediaPlayer2 Identity`));
    const meta = inside(`${d} --method org.freedesktop.DBus.Properties.Get org.mpris.MediaPlayer2.Player Metadata`);
    show("gdbus Metadata", meta);
    // SetPosition ne vaut que pour la piste COURANTE (MPRIS : un identifiant périmé est ignoré).
    const trackId = /objectpath '([^']+)'/.exec(meta)?.[1] ?? "/";
    show("gdbus PlaybackStatus", inside(`${d} --method org.freedesktop.DBus.Properties.Get org.mpris.MediaPlayer2.Player PlaybackStatus`));
    inside(`for m in Pause Next Previous; do ${d} --method org.mpris.MediaPlayer2.Player.$m >/dev/null; done;
      ${d} --method org.mpris.MediaPlayer2.Player.SetPosition ${trackId} 6000000 >/dev/null`);
    await sleep(800);
    show("reçu par la page", await cdp.eval("JSON.stringify(window.__remote)"));
    show("time-pos après SetPosition(6 s)", await cdp.eval(prop("time-pos")));
    await cdp.eval("window.tentacle.invoke('audio_engine_stop', {})");
    await sleep(800);
    show("noms MPRIS après l'arrêt", inside(`gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus \
      --method org.freedesktop.DBus.ListNames | tr "," "\\n" | grep -c mpris`));
  } else {
    console.error("usage : prove-integ.mjs kept [n] | dialog | mpris");
    process.exitCode = 2;
  }
} finally {
  cdp.close?.();
}
