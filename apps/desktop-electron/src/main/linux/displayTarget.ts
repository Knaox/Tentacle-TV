/**
 * La visée d'écran par la MESURE de la page — la seule qui dise vrai sur Wayland.
 *
 * # Pourquoi mesurer, plutôt que demander à Electron
 *
 * Sur Wayland, `getBounds()` rend (0,0) pour TOUTE fenêtre — le protocole ne
 * donne pas la position. `getDisplayMatching()` désigne donc toujours l'écran
 * posé à l'origine, et la visée qui s'y fiait envoyait mpv sur le mauvais
 * moniteur (mesuré, docs/LINUX-FENETRE-VIDEO.md, « L'empilement multi-écrans »).
 *
 * Le trio `innerWidth` / `innerHeight` / `devicePixelRatio` d'une fenêtre
 * PLEIN ÉCRAN, lui, est celui de son moniteur : la taille logique et la densité
 * suffisent à le reconnaître — sur le poste de mesure, deux écrans partagent la
 * même taille logique et seule la densité les sépare.
 *
 * # Pourquoi la garde « plein écran », et pourquoi une attente
 *
 * Une fenêtre FENÊTRÉE de 1920×1080 posée sur un écran 4K correspondrait à
 * l'écran 1080p d'à côté : identification d'apparence valide, écran faux. Le
 * trio ne dit quelque chose que d'une fenêtre plein écran effectivement mappée
 * — et le compositeur met ~200 ms à la mapper (202-203 ms sur trois runs).
 * D'où `libelleUneFoisMappee` : la mesure se rejoue jusqu'à désigner un écran.
 *
 * Un zoom de page (Ctrl+molette) fausse le trio : plus aucune correspondance,
 * et l'on rend `null` — dans le doute, on ne force rien (cf. `ecrans.ts`).
 */

import { screen } from "electron";
import { ecranPourMesure, type EcranCandidat, type MesurePage } from "./ecrans";

/** Le strict nécessaire d'une fenêtre — et ce qu'un test sait imiter. */
export interface FenetreMesurable {
  isDestroyed(): boolean;
  isFullScreen(): boolean;
  webContents: {
    executeJavaScript(code: string, gestureUtilisateur?: boolean): Promise<unknown>;
  };
}

/** Les écrans d'Electron, réduits à ce que la mesure sait comparer. */
export function candidatsAffiches(): EcranCandidat[] {
  return screen.getAllDisplays().map((d) => ({
    label: d.label,
    largeur: d.size.width,
    hauteur: d.size.height,
    densite: d.scaleFactor,
  }));
}

/** Le trio mesuré par la page — ou `null` si elle ne répond pas en nombres. */
export async function mesureDeLaPage(
  page: FenetreMesurable["webContents"],
): Promise<MesurePage | null> {
  try {
    const brut: unknown = await page.executeJavaScript(
      "[innerWidth, innerHeight, devicePixelRatio]",
      true,
    );
    if (!Array.isArray(brut) || brut.length !== 3) return null;
    const nombre = (n: unknown): n is number =>
      typeof n === "number" && Number.isFinite(n) && n > 0;
    const [largeur, hauteur, densite] = brut as unknown[];
    if (!nombre(largeur) || !nombre(hauteur) || !nombre(densite)) return null;
    return { largeur, hauteur, densite };
  } catch {
    return null;
  }
}

/**
 * Le libellé de l'écran qui porte la fenêtre, par la mesure de la page.
 * `null` tant que la fenêtre n'est pas en plein écran, si la mesure échoue,
 * ou si elle reste ambiguë (deux écrans jumeaux).
 */
export async function libelleParMesure(
  hote: FenetreMesurable,
  candidats: readonly EcranCandidat[],
): Promise<string | null> {
  if (hote.isDestroyed() || !hote.isFullScreen()) return null;
  const mesure = await mesureDeLaPage(hote.webContents);
  return mesure ? ecranPourMesure(mesure, candidats) : null;
}

/** Ce que `libelleUneFoisMappee` accepte de régler. */
export interface AttenteMappage {
  /** Nombre de mesures avant d'abandonner (défaut 20, soit ~2 s). */
  essais?: number;
  /** Pas entre deux mesures, en millisecondes (défaut 100). */
  pasMs?: number;
  /** Rend `false` pour couper une attente devenue sans objet (détachement). */
  encore?: () => boolean;
  /** Écrans candidats — recalculés à chaque pas si absent (un écran peut arriver). */
  candidats?: readonly EcranCandidat[];
}

/**
 * Attend que la mesure désigne un écran — la fenêtre vient d'être mise en
 * plein écran et le compositeur ne l'a pas encore mappée. `null` après
 * épuisement : fenêtre jamais mappée, trio jamais reconnu, ou attente coupée.
 */
export async function libelleUneFoisMappee(
  hote: FenetreMesurable,
  reglages: AttenteMappage = {},
): Promise<string | null> {
  const { essais = 20, pasMs = 100, encore = () => true } = reglages;
  for (let i = 0; i < essais; i++) {
    if (!encore() || hote.isDestroyed()) return null;
    const libelle = await libelleParMesure(hote, reglages.candidats ?? candidatsAffiches());
    if (libelle !== null) return libelle;
    await new Promise((r) => setTimeout(r, pasMs));
  }
  return null;
}
