/**
 * Actions du panneau de diagnostic — DÉVELOPPEMENT UNIQUEMENT.
 *
 * Chaque action bascule un réglage de mpv EN COURS DE LECTURE, pour juger à
 * l'œil ce que change ce réglage sur l'image réellement affichée. C'est la
 * seule façon honnête de trancher : une capture d'écran d'un écran HDR est
 * ramenée en SDR et ne prouve rien.
 *
 * Séparé du composant : ce sont des commandes, pas de l'affichage, et la
 * limite de 300 lignes par fichier vaut aussi pour les outils.
 */

import { invoke } from "../desktop/bridge";
import { supportsSurfaceProbe } from "../desktop/capabilities";
import { getMpvApi } from "../hooks/mpvRuntime";
import { requetesSortantes, viderSondeReseau } from "./networkProbe";
import { sonder, verdictSonde } from "./surfaceProbe";

/** Une bascule offerte par le panneau. */
export interface DebugAction {
  /** Touche qui la déclenche, en minuscule. */
  touche: string;
  libelle: string;
  /** Renvoie ce qu'il faut afficher en retour, ou `null` si rien à dire. */
  executer: () => Promise<string | null>;
}

async function lire(nom: string): Promise<string | null> {
  const api = getMpvApi();
  if (!api) return null;
  try {
    const v = await api.getProperty(nom, "string");
    return v === null || v === undefined ? null : String(v);
  } catch {
    return null;
  }
}

async function ecrire(nom: string, valeur: string): Promise<void> {
  const api = getMpvApi();
  if (!api) return;
  try {
    await api.setProperty(nom, valeur);
  } catch {
    /* propriété refusée par ce build de mpv : sans conséquence ici */
  }
}

/** Bascule une propriété entre deux valeurs et renvoie la nouvelle. */
async function alterner(nom: string, a: string, b: string): Promise<string | null> {
  const courant = await lire(nom);
  const suivant = courant === a ? b : a;
  await ecrire(nom, suivant);
  return `${nom} = ${suivant}`;
}

export const ACTIONS: readonly DebugAction[] = [
  {
    touche: "r",
    libelle: "R · vider le journal réseau",
    // Le geste qui rend la section utile : on vide, on lance la lecture, et ce
    // qui apparaît est EXACTEMENT ce que cette lecture a provoqué. Sans remise
    // à zéro, le trafic du catalogue noie celui du lecteur.
    executer: async () => {
      const avant = requetesSortantes().length;
      viderSondeReseau();
      return `journal vidé — ${avant} requête${avant > 1 ? "s" : ""} effacée${avant > 1 ? "s" : ""}`;
    },
  },
  {
    touche: "p",
    libelle: "P · passthrough HDR",
    // Le réglage qui décide de tout : `yes` transmet le signal PQ tel quel —
    // parfait sur un écran en HDR, quasi noir sur un écran SDR. `no` demande à
    // mpv de convertir. Basculer en direct montre la différence sans ambiguïté.
    executer: () => alterner("target-colorspace-hint", "yes", "no"),
  },
  {
    touche: "t",
    libelle: "T · tone-mapping",
    executer: () => alterner("tone-mapping", "st2094-40", "bt.2446a"),
  },
  {
    touche: "g",
    libelle: "G · gamut cible",
    executer: () => alterner("target-prim", "auto", "bt.2020"),
  },
  {
    touche: "d",
    libelle: "D · décodage matériel",
    executer: () => alterner("hwdec", "auto-safe", "no"),
  },
  {
    touche: "i",
    libelle: "I · image affichée",
    // Ce que l'écran reçoit VRAIMENT, par opposition à ce que contient le
    // fichier : primaires et courbe de transfert effectivement demandées à la
    // sortie, une fois tone-mapping et passthrough appliqués.
    executer: async () => {
      const [prim, trc, peak, hint] = await Promise.all([
        lire("target-prim"),
        lire("target-trc"),
        lire("target-peak"),
        lire("target-colorspace-hint"),
      ]);
      return `affiché : ${prim ?? "?"} / ${trc ?? "?"} / pic ${peak ?? "?"} · passthrough ${hint ?? "?"}`;
    },
  },
  ...(supportsSurfaceProbe()
    ? [
        {
          touche: "c",
          libelle: "C · capturer la surface",
          // LA question à laquelle aucune propriété ne répond : voit-on quelque
          // chose ? Sur macOS l'image vit dans une fenêtre native placée sous
          // la page ; le natif la capture et compte ses pixels. Une vidéo et un
          // aplat noir ne se ressemblent sur aucun des trois chiffres rendus.
          executer: async (): Promise<string | null> => verdictSonde(await sonder()),
        },
      ]
    : []),
  {
    touche: "h",
    libelle: "H · bascule HDR de l'écran",
    executer: async () => {
      try {
        const etat = await invoke<{ actif: boolean; autoAutorise: boolean }>("display_hdr_state");
        await invoke("display_hdr_auto", { on: !etat.autoAutorise });
        return `bascule automatique ${etat.autoAutorise ? "désactivée" : "activée"} — écran ${etat.actif ? "en HDR" : "en SDR"}`;
      } catch {
        return "commande HDR indisponible";
      }
    },
  },
] as const;
