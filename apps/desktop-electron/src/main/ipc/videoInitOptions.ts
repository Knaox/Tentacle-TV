/**
 * L'assemblage des options d'init de mpv : ce que la page demande, ce que la
 * coquille y ajoute, ce que le montage réécrit.
 *
 * Extrait de `ipc/video.ts` pour tenir la limite de 300 lignes, et parce que
 * décider des options est un métier distinct d'exposer des commandes.
 */

import path from "node:path";
import { app, type BrowserWindow } from "electron";
import { windowIconPath } from "../appIcon";
import { filterInitOptions, type MpvValue } from "../video/mpvAllowlist";
import { adaptToFullscreen } from "../video/macosWindowOptions";
import { withWritableLogFile } from "../video/mpvLogFile";
import { withShaderCache } from "../video/mpvShaderCache";
import { videoMontage } from "../video/surface";
import { pageMeasure } from "../linux/displayTarget";
import { initialGeometryOption } from "../linux/initialGeometry";
import { linuxWindowing, linuxMontage } from "../linux/session";
import { mpvWindowTitle, prepareVideoWindowIdentity } from "../linux/videoWindowIdentity";

/**
 * Les options mpv adaptées à l'écran — macOS SEULEMENT, et chargé à la demande :
 * `macosHdrOptions` tire le pont Objective-C, dont `koffi.load` s'exécute à
 * l'import et tue le processus sur Linux et Windows avant la première fenêtre
 * (mesuré le 9 sept. 2026 : « Failed to load shared library »). Ailleurs, les
 * options passent telles quelles.
 */
function adaptToDisplay(
  options: Readonly<Record<string, MpvValue>>,
  host: BrowserWindow,
): Record<string, MpvValue> {
  if (process.platform !== "darwin") return { ...options };
  const macos = require("../video/macosHdrOptions") as typeof import("../video/macosHdrOptions");
  return macos.adaptToDisplay(options, host);
}

/**
 * La réécriture Render API des options, chargée À LA DEMANDE.
 *
 * ⚠️ `macosRenderOptions.ts` n'importe plus rien de natif, mais l'`import`
 * reste hors de la tête de fichier : la paresse garantit qu'un import ajouté
 * là-bas par mégarde (`objc.ts` charge `libobjc.A.dylib`, introuvable sur
 * Windows) ne tue pas le processus principal. Miroir de `surface.ts` (`a9a1f065`).
 */
function renderApiOptions(
  kept: Readonly<Record<string, MpvValue>>,
): Record<string, MpvValue> {
  const { adaptForRenderApi } =
    require("../video/macosRenderOptions") as typeof import("../video/macosRenderOptions");
  return adaptForRenderApi(kept);
}

/**
 * Montage collé : le titre et l'app-id de la fenêtre mpv. Pendant la lecture,
 * c'est elle qu'Alt+Tab montre — sous notre nom et notre icône, pas sous ceux
 * de mpv. Voir `linux/videoWindowIdentity.ts`. Constants pour un lancement :
 * ils n'empêchent pas la reprise d'une instance garée (`mpvPark.ts`).
 */
function videoWindowIdentityOptions(win: BrowserWindow): Record<string, MpvValue> {
  const folder = path.join(app.getPath("userData"), "video-window");
  const appId = prepareVideoWindowIdentity(folder, windowIconPath());
  return {
    title: mpvWindowTitle(win.getTitle()),
    ...(appId === null ? {} : { "wayland-app-id": appId }),
  };
}

/** Les options que mpv recevra, dans l'ordre où la page, la coquille et le montage les posent. */
export async function assembleInitOptions(
  win: BrowserWindow,
  page: Readonly<Record<string, MpvValue>>,
): Promise<Record<string, MpvValue>> {
  // Les options d'init sont passées VERBATIM à mpv. Parmi les 959
  // propriétés de la libmpv du dépôt figurent `scripts` (chargement de
  // code Lua), `input-ipc-server` (tuyau nommé donnant le contrôle total
  // de mpv) et `input-conf` — relevé par sonde. On ne retient donc que ce
  // que `buildMpvInitOptions` produit. Une option écartée est IGNORÉE et
  // non rejetée : mpv lui-même tolère les options inconnues, et faire
  // échouer `mpv_init` empêcherait toute lecture.
  const { kept } = filterInitOptions(page);
  // Le journal que la page demande arrive sans chemin utilisable : c'est
  // ici qu'il en reçoit un que le bac à sable laisse écrire. Le cache de
  // nuanceurs, lui, n'existe pas du tout sous libmpv sans dossier
  // explicite — voir `mpvShaderCache.ts`.
  const asked = withShaderCache(withWritableLogFile(kept), app.getPath("userData"));
  // Le montage Render API réécrit ce que la page a demandé : elle décrit
  // ce qu'elle veut voir, le processus principal sait comment l'obtenir.
  // Voir `macosRenderOptions.ts`.
  // Et le montage à deux fenêtres a sa propre réécriture : une lecture qui
  // démarre alors que l'app est DÉJÀ en plein écran doit dire à mpv de ne
  // pas laisser macOS ouvrir un second bureau. Voir `macosWindowOptions.ts`.
  const mpvOptions =
    videoMontage() === "gl"
      ? renderApiOptions(asked)
      : adaptToDisplay(adaptToFullscreen(asked, win), win);
  // Montage fenêtré libre (colle KDE) : mpv naît à la TAILLE de l'hôte —
  // sans quoi il naît à la taille du média, plein écran apparent pendant
  // ~0,5 s avant le premier coller() (voir linux/initialGeometry.ts).
  // La taille vient de la PAGE — `devicePixelRatio` compris — et non de
  // `screen.getDisplayMatching(getBounds())`, qui désigne l'écran à l'origine
  // sur Wayland (×1,25 lus pour un écran ×2, mesuré le 17.09.2026). Une
  // milliseconde d'aller-retour, sur le seul montage qui en a besoin.
  const glued = linuxMontage() === "wayland" && linuxWindowing() === "libre";
  const measure = glued ? await pageMeasure(win.webContents) : null;
  const geometry = initialGeometryOption(linuxMontage(), linuxWindowing(), measure);
  const identity = glued ? videoWindowIdentityOptions(win) : {};
  return { ...mpvOptions, ...geometry, ...identity };
}
