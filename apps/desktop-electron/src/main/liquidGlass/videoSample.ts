/**
 * La vidéo SOUS la page, pour `liquidGlass.sample` : l'image que mpv a décodée,
 * demandée à mpv lui-même (`screenshot-raw video bgra`) et lue aux seuls points
 * de la grille de chaque rectangle (`videoLayout.ts`).
 *
 * # Pourquoi mpv, et pas une capture du système (mesuré au banc le 22/10)
 *
 * - `capturePage` ne voit que la page, transparente au-dessus de la vidéo.
 * - `CGWindowListCreateImage` : retirée du SDK 15 ; liée au SDK 26.4 d'Electron,
 *   elle rend des images VIDES (0 partout, notre propre fenêtre comprise).
 * - ScreenCaptureKit, même par le contenu « du processus courant » (macOS
 *   14.4, « sans consentement ») : `-3811` sur toutes nos fenêtres, app lancée
 *   par le Dock ou non — et, sans l'autorisation, le fil principal est resté
 *   retenu 9,2 s puis l'autorisation « Enregistrement de l'écran » est passée
 *   de non à oui : la demande s'est très probablement affichée. Exclu.
 * mpv, lui, sait rendre l'image qu'il montre : rien de privé, aucune
 * autorisation, l'image décodée ramenée en sRGB (le HDR PQ / BT.2020 compris :
 * valeurs relevées sur une mire, teintes et sens justes).
 *
 * # Le coût, et qui le paie
 *
 * La capture GPU de `gpu-next` échoue sur MoltenVK ; mpv se replie seul sur sa
 * capture LOGICIELLE de l'image décodée : 25 à 67 ms en 1080p, 32 à 82 ms en 4K
 * HDR, sur le cœur de mpv — aucune image perdue au banc, même toutes les 250 ms.
 * La commande est asynchrone (`commandForResult`) : le fil principal n'attend
 * jamais, et `mpv_destroy` attend de lui-même une capture en vol. On lit la
 * grille pendant la réponse, puis mpv libère l'image. Une capture à la fois,
 * une par seconde au plus ; rien au repos : tout part d'un appel de la page.
 *
 * ⚠️ macOS, montage `fenetre` seulement : la vidéo est la fenêtre de mpv, fille
 * de celle de la page (le PiP compris). Ailleurs, `null` — la page reste seule.
 */

import koffi from "koffi";
import type { BrowserWindow } from "electron";
import { commandForResult, getProperty } from "../video/mpv";
import { fromHandle, msg } from "../video/objc";
import { classNameOf } from "../video/objcWindows";
import { MPV_WINDOW_CLASS } from "../video/macosWindowWatch";
import type { Box } from "./luminance";
import { displayAspect, gridPoints, videoLayout, videoSamples } from "./videoLayout";

/** La page en demande une toutes les 2 s, contrôles affichés : une par seconde au plus, quoi qu'elle fasse. */
const MIN_INTERVAL_MS = 1000;

// `mpv_node` et compagnie (`client.h`), lus EN PLACE dans la réponse.
const NodeRef = koffi.struct("lg_mpv_node_ref", { u: "void *", format: "int" });
const NodeInt = koffi.struct("lg_mpv_node_int", { u: "int64_t", format: "int" });
const NodeList = koffi.struct("lg_mpv_node_list", { num: "int", values: "void *", keys: "void *" });
const ByteArray = koffi.struct("lg_mpv_byte_array", { data: "void *", size: "size_t" });
const NODE_SIZE = koffi.sizeof(NodeRef);
const POINTER_SIZE = koffi.sizeof("void *");
const FORMAT_STRING = 1;
const FORMAT_INT64 = 4;
const FORMAT_NODE_MAP = 8;
const FORMAT_BYTE_ARRAY = 9;

interface Frame {
  readonly width: number;
  readonly height: number;
  readonly stride: number;
  readonly data: unknown;
}

let queue: Promise<unknown> = Promise.resolve();
let lastShot = 0;

/** Le cadre de la fenêtre de mpv posée sous `host`, en points de sa vue ; `null` sans elle. */
function videoWindowUnder(host: BrowserWindow): Box | null {
  const window = msg.get(fromHandle(host.getNativeWindowHandle()), "window");
  const children = msg.get(window, "childWindows");
  for (let i = 0; i < msg.count(children, "count"); i += 1) {
    const child = msg.index(children, "objectAtIndex:", i);
    if (!classNameOf(child).includes(MPV_WINDOW_CLASS) || !msg.bool(child, "isVisible")) continue;
    // Deux cadres d'AppKit (origine en bas à gauche) : l'axe se retourne contre le haut de la vue.
    const content = msg.rectToScreen(window, msg.rect(msg.get(window, "contentView"), "frame"));
    const frame = msg.rect(child, "frame");
    return { x: frame.x - content.x, y: content.y + content.height - (frame.y + frame.height), width: frame.width, height: frame.height };
  }
  return null;
}

/** Les champs de l'image rendue par `screenshot-raw` (un nœud MAP), lus en place ; `null` si inattendus. */
function readFrame(result: unknown): Frame | null {
  const top = koffi.decode(result, NodeRef) as { u: unknown; format: number };
  if (top.format !== FORMAT_NODE_MAP || !top.u) return null;
  const list = koffi.decode(top.u, NodeList) as { num: number; values: unknown; keys: unknown };
  const numbers: Record<string, number> = {};
  let format = "";
  let data: unknown = null;
  for (let i = 0; i < list.num; i += 1) {
    const key = koffi.decode(koffi.decode(list.keys, i * POINTER_SIZE, "void *"), "char", -1) as string;
    const ref = koffi.decode(list.values, i * NODE_SIZE, NodeRef) as { u: unknown; format: number };
    if (ref.format === FORMAT_INT64) {
      numbers[key] = Number((koffi.decode(list.values, i * NODE_SIZE, NodeInt) as { u: number | bigint }).u);
    } else if (ref.format === FORMAT_STRING && key === "format") {
      format = koffi.decode(ref.u, "char", -1) as string;
    } else if (ref.format === FORMAT_BYTE_ARRAY && key === "data") {
      data = (koffi.decode(ref.u, ByteArray) as { data: unknown }).data;
    }
  }
  const { w, h, stride } = numbers;
  if (format !== "bgra" || !data || w === undefined || h === undefined || stride === undefined || !(w > 0 && h > 0)) return null;
  return { width: w, height: h, stride, data };
}

async function shoot(host: BrowserWindow, boxes: readonly (Box | null)[]): Promise<(Uint8Array | null)[] | null> {
  const wait = lastShot + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  if (host.isDestroyed()) return null;
  const window = videoWindowUnder(host);
  if (window === null) return null;
  const aspect = displayAspect(await getProperty("video-params"));
  const layout = aspect === null ? null : videoLayout(window, aspect);
  if (layout === null) return null;
  const points = boxes.map((box) => (box === null ? null : gridPoints(layout, box)));
  lastShot = Date.now();
  const shot = await commandForResult(["screenshot-raw", "video", "bgra"], (result) => {
    const frame = readFrame(result);
    if (frame === null) return null;
    const pixel = (x: number, y: number): number => koffi.decode(frame.data, y * frame.stride + x * 4, "uint32_t") as number;
    return points.map((grid) => (grid === null ? null : videoSamples(grid, frame.width, frame.height, pixel)));
  });
  return shot.value;
}

/**
 * La grille de la vidéo sous chaque rectangle (points de la vue de `host`,
 * comme `gridSamples` les dispose) ; `null` s'il n'y a pas de vidéo sous cette
 * page ou si mpv n'a pas d'image à rendre (ouverture, recherche).
 */
export function videoGrids(host: BrowserWindow, boxes: readonly (Box | null)[]): Promise<(Uint8Array | null)[] | null> {
  const run = queue.then(
    () => shoot(host, boxes),
    () => shoot(host, boxes),
  );
  queue = run.catch(() => undefined);
  return run;
}
