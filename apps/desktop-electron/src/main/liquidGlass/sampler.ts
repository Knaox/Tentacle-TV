/**
 * `liquidGlass.sample(rects)` : la luminance relative médiane sous chaque
 * rectangle de la page — pour que les surfaces de verre adaptent leurs glyphes
 * au contenu, comme le Liquid Glass d'Apple (demande de lg-tokens).
 *
 * Une seule capture par appel (`webContents.capturePage` sur l'UNION des
 * rectangles), réduite pour que le plus petit garde sa grille de 16 × 16, puis
 * relue par `luminance.ts`. Rien que des nombres repartent : jamais un pixel.
 *
 * ⚠️ La capture voit la PAGE, pas ce qui est sous la fenêtre : au-dessus de la
 * vidéo (page transparente), elle ne lit rien — `null`, et la page garde le ton
 * de son thème. La page appelle au plus toutes les 250 ms, au repos seulement ;
 * ici, une capture à la fois par page.
 */

import { BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import { isAppOrigin } from "../appProtocol";
import { medianLuminance, reductionFor, unionBox, type Box } from "./luminance";
import { LIQUID_GLASS_SAMPLE_CHANNEL, type GlassSampleRect } from "./protocol";
import { parseSampleRects } from "./validate";

let installed = false;
const queues = new WeakMap<WebContents, Promise<unknown>>();

/** Le rectangle visible de la vue web, en points. */
function viewBox(contents: WebContents): Box | null {
  const window = BrowserWindow.fromWebContents(contents);
  if (window === null || window.isDestroyed()) return null;
  const { width, height } = window.getContentBounds();
  return { x: 0, y: 0, width, height };
}

function clamp(box: Box, view: Box): Box | null {
  const x0 = Math.max(view.x, Math.floor(box.x));
  const y0 = Math.max(view.y, Math.floor(box.y));
  const x1 = Math.min(view.x + view.width, Math.ceil(box.x + box.width));
  const y1 = Math.min(view.y + view.height, Math.ceil(box.y + box.height));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

async function measure(contents: WebContents, rects: readonly GlassSampleRect[]): Promise<(number | null)[]> {
  const nothing = rects.map(() => null);
  const view = viewBox(contents);
  if (view === null || contents.isDestroyed()) return nothing;
  const zoom = contents.getZoomFactor();
  const boxes = rects.map((r) => ({ x: r.x * zoom, y: r.y * zoom, width: r.width * zoom, height: r.height * zoom }));
  const area = clamp(unionBox(boxes), view);
  if (area === null) return nothing;
  let image: Electron.NativeImage;
  try {
    image = await contents.capturePage(area);
  } catch {
    return nothing;
  }
  if (image.isEmpty()) return nothing;
  const factor = reductionFor(boxes);
  const reduced = factor < 1 ? image.resize({ width: Math.max(1, Math.round(area.width * factor)), quality: "good" }) : image;
  const bitmap = reduced.toBitmap();
  // La représentation rendue peut être à 1x ou 2x : ses vraies dimensions se
  // déduisent de la taille du tampon, jamais d'une échelle supposée.
  const size = reduced.getSize();
  const scale = Math.sqrt(bitmap.length / 4 / Math.max(1, size.width * size.height));
  const width = Math.round(size.width * scale);
  const height = Math.round(size.height * scale);
  if (width * height * 4 > bitmap.length) return nothing;
  const sx = width / area.width;
  const sy = height / area.height;
  return boxes.map((b) =>
    medianLuminance(bitmap, width, height, { x: (b.x - area.x) * sx, y: (b.y - area.y) * sy, width: b.width * sx, height: b.height * sy }),
  );
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
