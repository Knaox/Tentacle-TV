// Fermer l'app en pleine lecture : Jellyfin doit voir la lecture s'arrêter, comme sous
// Electron (`playbackFarewell.ts` : pause mpv + `Sessions/Playing/Stopped` à `will-quit`),
// et non la garder « en cours » jusqu'à sa minuterie d'inactivité (5 min). Sous CEF, la page
// est servie par l'origine du serveur : son propre filet (`pagehide` → beacon, ou canal de
// session du backend) a sa chance. La fermeture passe par le vrai chemin (`shell.quit` →
// SDL_EVENT_QUIT → fermeture du navigateur), puis on lit `/Sessions` chez Jellyfin.
//   PONT_CDP_PORT=9313 node bench/lecteur/adieu.mjs   (compte connecté, app lancée --mute)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connect, findItem, sleep } from "../../web/shim/dev/drive.mjs";

const cache = process.env.TENTACLE_CEF_CACHE ?? join(process.env.HOME, ".cache/tentacle-cef");
const accounts = JSON.parse(readFileSync(join(cache, "banc/comptes.json"), "utf8"));
const AUTH = `MediaBrowser Client="tentacle-cef-banc", Device="banc", DeviceId="tentacle-cef-banc-${process.env.PONT_CDP_PORT ?? 9303}-api", Version="1.0"`;
// Un DeviceId à part : `findItem` se connecte sous celui du port, ce qui révoquerait ce jeton.
const login = await (await fetch(`${accounts.jellyfin}/Users/AuthenticateByName`, {
  method: "POST", headers: { "content-type": "application/json", authorization: AUTH },
  body: JSON.stringify({ Username: accounts.admin.name, Pw: accounts.admin.password }),
})).json();
const jf = async (path) => (await fetch(`${accounts.jellyfin}${path}`, { headers: { authorization: `${AUTH}, Token="${login.AccessToken}"` } })).json();

const d = await connect();
const { cdp, check } = d;
const { item } = await findItem("Banc Pistes SDR");
const playing = async () => (await jf("/Sessions?ActiveWithinSeconds=900")).filter((s) => s.NowPlayingItem?.Id === item.Id);

await d.playFromDetail(item.Id);
await d.waitFor(async () => (await d.last("time-pos")) > 1, 15000);
await sleep(1500);
if ((await d.last("pause")) === true) { await d.wake(); await d.key("Space"); }
// Au moins un report de progression (le front en poste toutes les 10 s).
await sleep(12000);
const before = await playing();
const pos = await d.last("time-pos");
check("Jellyfin voit la lecture", before.length > 0,
  `${before.length} session(s) sur « ${item.Name} » (${before.map((s) => `${s.Client}/${s.DeviceName}, pause=${s.PlayState?.IsPaused}, ` +
    `${((s.PlayState?.PositionTicks ?? 0) / 1e7).toFixed(1)} s`).join(" ; ")}), time-pos ${pos?.toFixed(1)} s`);

// La fermeture, comme Cmd+Q : la page ne répond plus après, le DevTools tombe avec l'app.
const t0 = Date.now();
await cdp.eval(`window.__shell.invoke("shell.quit", {}).catch(() => null); true`).catch(() => null);
let left = before;
while (Date.now() - t0 < 20000 && left.length) { await sleep(250); left = await playing(); }
check("fermée en lecture : Jellyfin ne la voit plus en cours", left.length === 0,
  left.length ? `toujours ${left.length} session(s) en lecture après ${Date.now() - t0} ms`
    : `arrêt vu en ${Date.now() - t0} ms`);
const ud = (await jf(`/Users/${login.User.Id}/Items/${item.Id}`)).UserData ?? {};
console.log(`   ℹ︎ UserData : LastPlayedDate=${ud.LastPlayedDate ?? "-"}, PlaybackPositionTicks=${ud.PlaybackPositionTicks ?? 0} ` +
  `(titre de ${Math.round((item.RunTimeTicks ?? 0) / 1e7)} s : Jellyfin ne garde une position qu'au-delà de 300 s)`);
d.finish();
