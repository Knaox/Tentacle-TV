// Mode muet des bancs (`--mute`) : la page a beau restaurer « volume 50, non muet » puis
// envoyer `set mute no`, `cycle mute` et `mute=false`, mpv reste `ao=null` + `mute=yes`.
//   PONT_CDP_PORT=9313 node bench/lecteur/muet.mjs   (compte connecté, app lancée --mute)
import { connect, findItem, sleep } from "../../web/shim/dev/drive.mjs";

const d = await connect();
const { cdp, check } = d;
const get = (n) => cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: "${n}", format: "node" })`);
await cdp.eval(`localStorage.setItem("tentacle_player_volume", "50"); localStorage.setItem("tentacle_player_muted", "0"); true`);
await d.playFromDetail((await findItem("Banc HDR10 Pistes")).item.Id);
await d.waitFor(async () => (await d.last("time-pos")) > 0.5, 15000);
await sleep(1000);
check("restauré par la page, toujours muet", (await get("current-ao")) === "null" && (await get("mute")) === true,
  `ao=${await get("current-ao")} mute=${await get("mute")} volume=${await get("volume")}`);
for (const call of [`mpv_command", { name: "set", args: ["mute", "no"] }`, `mpv_command", { name: "cycle", args: ["mute"] }`,
  `mpv_set_property", { name: "mute", value: false }`]) await cdp.eval(`window.tentacle.invoke("${call})`);
await sleep(500);
check("set/cycle/setProperty mute=no refusés", (await get("current-ao")) === "null" && (await get("mute")) === true,
  `ao=${await get("current-ao")} mute=${await get("mute")}`);
await d.key("Escape");
await sleep(1500);
d.finish();
