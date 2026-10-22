/**
 * `liquidGlass.sample(rects)` : la luminance relative médiane sous chaque
 * rectangle de la page — pour que les surfaces de verre adaptent leurs glyphes
 * au contenu, comme le Liquid Glass d'Apple (demandes de lg-tokens, puis de
 * lg-lecteur pour le lecteur).
 *
 * La PAGE : une capture par appel (`webContents.capturePage` sur l'UNION des
 * rectangles), réduite pour que le plus petit garde sa grille de 16 × 16.
 * Là où elle laisse voir le dessous, la VIDÉO : l'image décodée de mpv
 * (`videoSample.ts`, macOS, montage `fenetre`), composée SOUS la page point par
 * point (`compositeOver`) — ce que l'œil voit, au verre natif près. Avec
 * `under: "window"`, la vidéo SEULE : une capsule du lecteur ne mesure ni ses
 * glyphes ni ses halos, dont le ton dépend de la mesure (sinon, elle se
 * mesurerait elle-même). Rien que des nombres repartent : jamais un pixel.
 *
 * Une capture à la fois par page ; sur la vidéo, une par seconde au plus. Rien
 * au repos : tout part d'un appel de la page.
 */

import { BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import { isAppOrigin } from "../appProtocol";
import { compositeOver, gridSamples, medianOfSamples, reductionFor, seesThrough, unionBox, type Box } from "./luminance";
import { LIQUID_GLASS_SAMPLE_CHANNEL, type GlassSampleRect } from "./protocol";
import { parseSampleRects } from "./validate";

let installed = false;
const queues = new WeakMap<WebContents, Promise<unknown>>();

function clamp(box: Box, view: Box): Box | null {
  const x0 = Math.max(view.x, Math.floor(box.x));
  const y0 = Math.max(view.y, Math.floor(box.y));
  const x1 = Math.min(view.x + view.width, Math.ceil(box.x + box.width));
  const y1 = Math.min(view.y + view.height, Math.ceil(box.y + box.height));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** La vidéo sous la page, macOS seulement : `videoSample.ts` tire AppKit et mpv. */
function videoUnder(window: BrowserWindow, boxes: readonly (Box | null)[]): Promise<(Uint8Array | null)[] | null> {
  if (process.platform !== "darwin") return Promise.resolve(null);
  try {
    const { videoGrids } = require("./videoSample") as typeof import("./videoSample");
    return videoGrids(window, boxes).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

/** La grille de la page sous chaque boîte (points de la vue) ; `null` : pas demandée, ou capture en échec. */
async function pageGrids(contents: WebContents, boxes: readonly (Box | null)[]): Promise<(Uint8Array | null)[]> {
  const none = boxes.map(() => null);
  const present = boxes.filter((box): box is Box => box !== null);
  if (present.length === 0) return none;
  const area = unionBox(present);
  let image: Electron.NativeImage;
  try {
    image = await contents.capturePage(area);
  } catch {
    return none;
  }
  if (image.isEmpty()) return none;
  const factor = reductionFor(present);
  const reduced = factor < 1 ? image.resize({ width: Math.max(1, Math.round(area.width * factor)), quality: "good" }) : image;
  const bitmap = reduced.toBitmap();
  // La représentation rendue peut être à 1x ou 2x : ses vraies dimensions se
  // déduisent de la taille du tampon, jamais d'une échelle supposée.
  const size = reduced.getSize();
  const scale = Math.sqrt(bitmap.length / 4 / Math.max(1, size.width * size.height));
  const width = Math.round(size.width * scale);
  const height = Math.round(size.height * scale);
  if (width * height * 4 > bitmap.length) return none;
  const sx = width / area.width;
  const sy = height / area.height;
  return boxes.map((b) =>
    b === null ? null : gridSamples(bitmap, width, height, { x: (b.x - area.x) * sx, y: (b.y - area.y) * sy, width: b.width * sx, height: b.height * sy }),
  );
}

async function measure(contents: WebContents, rects: readonly GlassSampleRect[]): Promise<(number | null)[]> {
  const window = BrowserWindow.fromWebContents(contents);
  if (window === null || window.isDestroyed() || contents.isDestroyed()) return rects.map(() => null);
  const { width: viewWidth, height: viewHeight } = window.getContentBounds();
  const view = { x: 0, y: 0, width: viewWidth, height: viewHeight };
  const zoom = contents.getZoomFactor();
  // En points de la vue, rognés à ce qu'elle montre : la page et la vidéo y lisent la MÊME grille.
  const boxes = rects.map((r) => clamp({ x: r.x * zoom, y: r.y * zoom, width: r.width * zoom, height: r.height * zoom }, view));
  const behind = rects.map((r) => r.under === "window");
  const pages = await pageGrids(contents, boxes.map((box, k) => (behind[k] ? null : box)));
  const wantsVideo = boxes.some((box, k) => box !== null && behind[k]) || pages.some((page) => page !== null && seesThrough(page));
  const videos = wantsVideo ? await videoUnder(window, boxes) : null;
  return rects.map((_rect, k) => {
    const video = videos?.[k] ?? null;
    if (behind[k]) return video === null ? null : medianOfSamples(video);
    const page = pages[k] ?? null;
    if (page === null) return null;
    return medianOfSamples(video === null ? page : compositeOver(page, video));
  });
}

async function sample(event: IpcMainInvokeEvent, raw: unknown): Promise<(number | null)[]> {
  if (!isAppOrigin(event.senderFrame?.url ?? "")) return [];
  const rects = parseSampleRects(raw);
  if (rects === null || rects.length === 0) return [];
  const contents = event.sender;
  const previous = queues.get(contents) ?? Promise.resolve();
  const run = previous.then(
    () => measure(contents, rects),
    () => measure(contents, rects),
  );
  queues.set(contents, run.catch(() => undefined));
  return run;
}

/** Branché une fois, avec le verre natif (`install.ts`). */
export function installGlassSampler(): void {
  if (installed) return;
  installed = true;
  ipcMain.handle(LIQUID_GLASS_SAMPLE_CHANNEL, sample);
}
