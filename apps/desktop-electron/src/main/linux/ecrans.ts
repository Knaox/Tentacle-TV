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

export interface EcranConnecte {
  /** Nom de connecteur, tel que mpv l'attend : `DP-3`, `HDMI-A-1`… */
  connecteur: string;
  /** Nom du moniteur lu dans l'EDID : `DELL S2721DGF`. */
  nom: string;
}

/** Le nom du moniteur porté par un EDID, ou `null`. */
export function nomEdid(edid: Buffer): string | null {
  // Les quatre descripteurs de 18 octets commencent à l'offset 54. Celui dont
  // l'en-tête vaut `00 00 00 FC` porte le nom, sur 13 octets, terminé par `0A`.
  if (edid.length < 128) return null;
  for (let i = 54; i + 18 <= 126; i += 18) {
    if (edid[i] !== 0 || edid[i + 1] !== 0 || edid[i + 2] !== 0 || edid[i + 3] !== 0xfc) continue;
    const nom = edid.subarray(i + 5, i + 18).toString("ascii").split("\n")[0]?.trim() ?? "";
    if (nom !== "") return nom;
  }
  return null;
}

/** Les écrans branchés, vus par le noyau. Jamais fatal : rend `[]` en cas d'échec. */
export function ecransConnectes(racine = "/sys/class/drm"): EcranConnecte[] {
  const trouves: EcranConnecte[] = [];
  let entrees: string[];
  try {
    entrees = readdirSync(racine);
  } catch {
    return trouves;
  }
  for (const entree of entrees) {
    // `card2-DP-3` → connecteur `DP-3`. Le préfixe de carte ne nous regarde pas.
    const separateur = entree.indexOf("-");
    if (!entree.startsWith("card") || separateur < 0) continue;
    const connecteur = entree.slice(separateur + 1);
    try {
      if (readFileSync(path.join(racine, entree, "status"), "utf8").trim() !== "connected") continue;
      const nom = nomEdid(readFileSync(path.join(racine, entree, "edid")));
      if (nom !== null) trouves.push({ connecteur, nom });
    } catch {
      // Un connecteur illisible n'empêche pas de lire les autres.
    }
  }
  return trouves;
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
export interface MesurePage {
  largeur: number;
  hauteur: number;
  densite: number;
}

/** Un écran candidat, réduit à ce que la mesure sait comparer. */
export interface EcranCandidat {
  label: string;
  largeur: number;
  hauteur: number;
  densite: number;
}

/**
 * Le libellé de l'écran qui correspond à la mesure — ou `null` si aucun, ou si
 * PLUSIEURS écrans identiques rendent la mesure ambiguë (deux moniteurs de même
 * taille et même densité) : dans le doute, on ne force rien.
 */
export function ecranPourMesure(
  mesure: MesurePage,
  ecrans: readonly EcranCandidat[],
): string | null {
  const trouves = ecrans.filter(
    (e) =>
      e.largeur === mesure.largeur &&
      e.hauteur === mesure.hauteur &&
      Math.abs(e.densite - mesure.densite) < 0.01,
  );
  return trouves.length === 1 ? (trouves[0]?.label ?? null) : null;
}

/** Normalise pour comparer deux noms écrits par deux fabricants différents. */
function reduire(texte: string): string {
  return texte.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Le connecteur correspondant au libellé d'un écran d'Electron, ou `null`.
 *
 * Le rapprochement se fait dans ce sens-là — le libellé CONTIENT le nom EDID —
 * et jamais l'inverse : « Dell Inc. DELL S2721DGF » contient « DELL S2721DGF »,
 * l'inverse serait faux.
 */
export function connecteurPourLibelle(
  libelle: string,
  ecrans: readonly EcranConnecte[],
): string | null {
  const cible = reduire(libelle);
  if (cible === "") return null;
  // Le nom le plus long d'abord : deux moniteurs d'une même gamme peuvent
  // partager un préfixe, et le plus précis doit gagner.
  const candidats = [...ecrans].sort((a, b) => b.nom.length - a.nom.length);
  for (const e of candidats) {
    const nom = reduire(e.nom);
    if (nom !== "" && cible.includes(nom)) return e.connecteur;
  }
  return null;
}
