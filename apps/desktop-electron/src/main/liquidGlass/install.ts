/**
 * Branche le verre natif sur une fenêtre : le canal de la page, le cycle de vie
 * de la fenêtre, la transparence de la surface, et l'instantané du banc.
 *
 * Sans verre natif (`detect.ts`), rien n'est branché : aucun écouteur, aucun
 * import d'AppKit — seul l'instantané du banc, hors paquet, dit pourquoi.
 */

import { app, ipcMain, type BrowserWindow, type IpcMainEvent, type WebContents } from "electron";
import { isAppOrigin } from "../appProtocol";
import { glassRefractsVideo, liquidGlassAvailability } from "./detect";
import { LIQUID_GLASS_CHANNEL } from "./protocol";
import { GlassRegions } from "./regions";
import type { GlassSnapshot } from "./snapshot";
import { parseBatch } from "./validate";

const managers = new WeakMap<WebContents, GlassRegions>();
let listening = false;
/** Un lot illisible ou une région écartée se dit — une fois par minute au plus. */
let lastComplaint = 0;

function complain(message: string): void {
  const now = Date.now();
  if (now - lastComplaint < 60_000) return;
  lastComplaint = now;
  console.warn(`[liquid-glass] ${message}`);
}

/** Le canal de la page : un lot par tâche JavaScript, sans réponse. */
function onBatch(event: IpcMainEvent, raw: unknown): void {
  const regions = managers.get(event.sender);
  if (regions === undefined) return;
  // Même règle que `ipc/registry.ts` : seule NOTRE page parle au verre.
  if (!isAppOrigin(event.senderFrame?.url ?? "")) return;
  const parsed = parseBatch(raw);
  if (parsed === null) return complain("lot illisible, ignore");
  if (parsed.rejected > 0) complain(`${parsed.rejected} element(s) ecarte(s) par la validation`);
  try {
    regions.apply(parsed.batch, event.sender.getZoomFactor());
  } catch (error) {
    // Une exception koffi se rattrape (une exception Objective-C, non : la
    // validation est là pour qu'il n'y en ait pas). Le verre est un confort.
    complain(`application du lot en echec : ${String(error)}`);
  }
}

/** Ce que le banc relit, par l'inspecteur du principal (`__tentacleGlass.snapshot()`). */
function exposeSnapshot(regions: GlassRegions | null): void {
  if (app.isPackaged) return;
  const availability = liquidGlassAvailability();
  const snapshot = (): GlassSnapshot => ({
    supported: availability === "native",
    availability,
    refractsVideo: glassRefractsVideo(),
    ...(regions?.snapshot() ?? {
      enabled: false,
      surfaceVisible: false,
      root: false,
      groups: 0,
      nativeViews: 0,
      regions: [],
    }),
  });
  (globalThis as { __tentacleGlass?: unknown }).__tentacleGlass = { snapshot };
}

/** Pose le verre natif sur la fenêtre principale, s'il existe. */
export function installLiquidGlass(win: BrowserWindow): void {
  if (liquidGlassAvailability() !== "native") return exposeSnapshot(null);
  const { AppKitGlassBackend } = require("./nativeGlass") as typeof import("./nativeGlass");
  const regions = new GlassRegions(
    new AppKitGlassBackend(win),
    { set: (callback, ms) => setTimeout(callback, ms), clear: (timer) => clearTimeout(timer) },
    (message) => console.warn(`[liquid-glass] ${message}`),
  );
  // La fenêtre naît au fond noir (`window.ts`) : surface opaque, verre caché.
  regions.setSurfaceVisible(false);
  const contents = win.webContents;
  managers.set(contents, regions);
  if (!listening) {
    listening = true;
    ipcMain.on(LIQUID_GLASS_CHANNEL, onBatch);
  }
  // Une page rechargée ne doit pas hériter du verre de la précédente : elle ne
  // saurait même pas qu'il est là. `did-navigate` ne vaut que pour une vraie
  // navigation — le routeur de la page n'en déclenche aucune.
  contents.on("did-navigate", () => regions.clear());
  contents.on("render-process-gone", () => regions.clear());
  // `closed` : la NSWindow est partie ou en partance — plus un message à ses
  // vues, seulement nos références rendues.
  win.on("closed", () => {
    regions.forget();
    managers.delete(contents);
  });
  exposeSnapshot(regions);
}

/**
 * La surface de Chromium devient transparente (lecture native) ou opaque : le
 * verre ne peut se voir que dans le premier cas. Appelé par
 * `setPlayerSurfaceTransparent` (`window.ts`), seule porte de cette transparence.
 */
export function glassSurfaceChanged(win: BrowserWindow, transparent: boolean): void {
  if (win.isDestroyed()) return;
  managers.get(win.webContents)?.setSurfaceVisible(transparent);
}
