/**
 * Quel écran porte la fenêtre — et comment le dire à mpv.
 *
 * # Le défaut que cela corrige
 *
 * Sur Wayland, ni nous ni mpv ne choisissons l'écran : chacun se met en plein
 * écran là où le compositeur le place. Sur un poste à plusieurs moniteurs, les
 * deux fenêtres partent donc sur des écrans DIFFÉRENTS. Mesuré le 25.08.2026,
 * trois écrans, journal des deux côtés :
 *
 *     fenêtre Electron  →  Dell S2721DGF      (DP-3)
 *     surface mpv       →  ASUSTek XG27UCDMG  (DP-4)
 *
 * L'utilisateur voit alors son interface d'un côté et son film de l'autre —
 * ou, plus exactement, il ne voit pas son film du tout.
 *
 * # Pourquoi passer par l'EDID
 *
 * mpv sait viser un écran, par `--fs-screen-name`, mais il n'accepte QUE le nom
 * de connecteur : `DP-3`. Mesuré, les trois formes essayées :
 *
 *     "DP-3"                            → mpv entre sur DP-3   ✅
 *     "Dell Inc. DELL S2721DGF"         → mpv reste sur DP-4   ❌
 *     "Dell Inc. DELL S2721DGF (DP-3)"  → mpv reste sur DP-4   ❌
 *
 * Or Electron ne donne pas le connecteur : son `Display.label` porte le nom
 * humain. Le noyau, lui, publie les deux — `/sys/class/drm/<carte>-<connecteur>/`
 * contient l'EDID, dont le descripteur `0xFC` porte le nom du moniteur. Relevé
 * sur ce poste :
 *
 *     card2-DP-2  Odyssey G40B    ← label Electron « Samsung … Odyssey G40B »
 *     card2-DP-3  DELL S2721DGF   ← label Electron « Dell Inc. DELL S2721DGF »
 *     card2-DP-4  XG27UCDMG       ← label Electron « ASUSTek … XG27UCDMG »
 *
 * Le libellé d'Electron CONTIENT le nom EDID : c'est là-dessus qu'on rapproche.
 * Lecture de fichiers, aucune bibliothèque, et cela marche sous X11 comme sous
 * Wayland puisque c'est le noyau qui parle.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface ConnectedDisplay {
  /** Nom de connecteur, tel que mpv l'attend : `DP-3`, `HDMI-A-1`… */
  connector: string;
  /** Nom du moniteur lu dans l'EDID : `DELL S2721DGF`. */
  name: string;
}

/** Le nom du moniteur porté par un EDID, ou `null`. */
export function edidName(edid: Buffer): string | null {
  // Les quatre descripteurs de 18 octets commencent à l'offset 54. Celui dont
  // l'en-tête vaut `00 00 00 FC` porte le nom, sur 13 octets, terminé par `0A`.
  if (edid.length < 128) return null;
  for (let i = 54; i + 18 <= 126; i += 18) {
    if (edid[i] !== 0 || edid[i + 1] !== 0 || edid[i + 2] !== 0 || edid[i + 3] !== 0xfc) continue;
    const name = edid.subarray(i + 5, i + 18).toString("ascii").split("\n")[0]?.trim() ?? "";
    if (name !== "") return name;
  }
  return null;
}

/** Les écrans branchés, vus par le noyau. Jamais fatal : rend `[]` en cas d'échec. */
export function connectedDisplays(root = "/sys/class/drm"): ConnectedDisplay[] {
  const found: ConnectedDisplay[] = [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return found;
  }
  for (const entry of entries) {
    // `card2-DP-3` → connecteur `DP-3`. Le préfixe de carte ne nous regarde pas.
    const separator = entry.indexOf("-");
    if (!entry.startsWith("card") || separator < 0) continue;
    const connector = entry.slice(separator + 1);
    try {
      if (readFileSync(path.join(root, entry, "status"), "utf8").trim() !== "connected") continue;
      const name = edidName(readFileSync(path.join(root, entry, "edid")));
      if (name !== null) found.push({ connector, name });
    } catch {
      // Un connecteur illisible n'empêche pas de lire les autres.
    }
  }
  return found;
}

/**
 * Ce que la PAGE mesure de sa fenêtre plein écran : taille logique et densité.
 *
 * ⚠️ C'est la SEULE identification d'écran fiable sur Wayland : Electron y rend
 * toutes les positions de fenêtre à (0,0) — mesuré, trois écrans, la fenêtre
 * plein écran sur l'ASUS rendait `getBounds()` = 0,0 et `getDisplayMatching`
 * désignait donc l'écran posé en 0,0 (le Dell), envoyant mpv sur le mauvais
 * moniteur. Le trio (largeur, hauteur, densité) d'une fenêtre PLEIN ÉCRAN, lui,
 * est celui de son moniteur.
 */
export interface PageMeasure {
  width: number;
  height: number;
  density: number;
}

/** Un écran candidat, réduit à ce que la mesure sait comparer. */
export interface DisplayCandidate {
  label: string;
  width: number;
  height: number;
  density: number;
}

/**
 * Le libellé de l'écran qui correspond à la mesure — ou `null` si aucun, ou si
 * PLUSIEURS écrans identiques rendent la mesure ambiguë (deux moniteurs de même
 * taille et même densité) : dans le doute, on ne force rien.
 */
export function displayForMeasure(
  measure: PageMeasure,
  displays: readonly DisplayCandidate[],
): string | null {
  const found = displays.filter(
    (e) =>
      e.width === measure.width &&
      e.height === measure.height &&
      Math.abs(e.density - measure.density) < 0.01,
  );
  return found.length === 1 ? (found[0]?.label ?? null) : null;
}

/** Normalise pour comparer deux noms écrits par deux fabricants différents. */
function shorten(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Le connecteur correspondant au libellé d'un écran d'Electron, ou `null`.
 *
 * Le rapprochement se fait dans ce sens-là — le libellé CONTIENT le nom EDID —
 * et jamais l'inverse : « Dell Inc. DELL S2721DGF » contient « DELL S2721DGF »,
 * l'inverse serait faux.
 */
export function connectorForLabel(
  label: string,
  displays: readonly ConnectedDisplay[],
): string | null {
  const target = shorten(label);
  if (target === "") return null;
  // Le nom le plus long d'abord : deux moniteurs d'une même gamme peuvent
  // partager un préfixe, et le plus précis doit gagner.
  const candidates = [...displays].sort((a, b) => b.name.length - a.name.length);
  for (const e of candidates) {
    const name = shorten(e.name);
    if (name !== "" && target.includes(name)) return e.connector;
  }
  return null;
}
