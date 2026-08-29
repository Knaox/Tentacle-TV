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
import { outgoingRequests, clearNetworkProbe } from "./networkProbe";
import { probeSurface, probeVerdict } from "./surfaceProbe";

/** Une bascule offerte par le panneau. */
export interface DebugAction {
  /** Touche qui la déclenche, en minuscule. */
  key: string;
  label: string;
  /** Renvoie ce qu'il faut afficher en retour, ou `null` si rien à dire. */
  run: () => Promise<string | null>;
}

async function readProp(name: string): Promise<string | null> {
  const api = getMpvApi();
  if (!api) return null;
  try {
    const v = await api.getProperty(name, "string");
    return v === null || v === undefined ? null : String(v);
  } catch {
    return null;
  }
}

async function writeProp(name: string, value: string): Promise<void> {
  const api = getMpvApi();
  if (!api) return;
  try {
    await api.setProperty(name, value);
  } catch {
    /* propriété refusée par ce build de mpv : sans conséquence ici */
  }
}

/** Bascule une propriété entre deux valeurs et renvoie la nouvelle. */
async function toggleBetween(name: string, a: string, b: string): Promise<string | null> {
  const current = await readProp(name);
  const next = current === a ? b : a;
  await writeProp(name, next);
  return `${name} = ${next}`;
}

export const DEBUG_ACTIONS: readonly DebugAction[] = [
  {
    key: "r",
    label: "R · vider le journal réseau",
    // Le geste qui rend la section utile : on vide, on lance la lecture, et ce
    // qui apparaît est EXACTEMENT ce que cette lecture a provoqué. Sans remise
    // à zéro, le trafic du catalogue noie celui du lecteur.
    run: async () => {
      const before = outgoingRequests().length;
      clearNetworkProbe();
      return `journal vidé — ${before} requête${before > 1 ? "s" : ""} effacée${before > 1 ? "s" : ""}`;
    },
  },
  {
    key: "p",
    label: "P · passthrough HDR",
    // Le réglage qui décide de tout : `yes` transmet le signal PQ tel quel —
    // parfait sur un écran en HDR, quasi noir sur un écran SDR. `no` demande à
    // mpv de convertir. Basculer en direct montre la différence sans ambiguïté.
    run: () => toggleBetween("target-colorspace-hint", "yes", "no"),
  },
  {
    key: "t",
    label: "T · tone-mapping",
    run: () => toggleBetween("tone-mapping", "st2094-40", "bt.2446a"),
  },
  {
    key: "g",
    label: "G · gamut cible",
    run: () => toggleBetween("target-prim", "auto", "bt.2020"),
  },
  {
    key: "d",
    label: "D · décodage matériel",
    run: () => toggleBetween("hwdec", "auto-safe", "no"),
  },
  {
    key: "i",
    label: "I · image affichée",
    // Ce que l'écran reçoit VRAIMENT, par opposition à ce que contient le
    // fichier : primaires et courbe de transfert effectivement demandées à la
    // sortie, une fois tone-mapping et passthrough appliqués.
    run: async () => {
      const [prim, trc, peak, hint] = await Promise.all([
        readProp("target-prim"),
        readProp("target-trc"),
        readProp("target-peak"),
        readProp("target-colorspace-hint"),
      ]);
      return `affiché : ${prim ?? "?"} / ${trc ?? "?"} / pic ${peak ?? "?"} · passthrough ${hint ?? "?"}`;
    },
  },
  ...(supportsSurfaceProbe()
    ? [
        {
          key: "c",
          label: "C · capturer la surface",
          // LA question à laquelle aucune propriété ne répond : voit-on quelque
          // chose ? Sur macOS l'image vit dans une fenêtre native placée sous
          // la page ; le natif la capture et compte ses pixels. Une vidéo et un
          // aplat noir ne se ressemblent sur aucun des trois chiffres rendus.
          run: async (): Promise<string | null> => probeVerdict(await probeSurface()),
        },
      ]
    : []),
  {
    key: "u",
    label: "U · pop-up de mise à jour",
    /**
     * Affiche la VRAIE pop-up de mise à jour, avec son vrai bouton.
     *
     * Elle ne s'affiche autrement que lorsqu'une mise à jour existe réellement —
     * autant dire jamais au moment où l'on travaille dessus, et jamais du tout
     * hors d'un paquet installé (le `StoreContext` de Windows n'existe pas en
     * développement, et le manifeste macOS ne se déclenche que sur une version
     * plus ancienne que celle publiée).
     *
     * Le bouton n'est PAS neutralisé : sur macOS il ouvre pour de bon la fiche
     * de l'App Store — c'est le seul moyen de vérifier que le lien aboutit sur
     * la bonne fiche, dans l'application App Store et non dans un navigateur.
     * Sur Windows il joue le déroulé complet, barre indéterminée comprise, sans
     * rien installer ni redémarrer (cf. `lib/updateSimulation.ts`).
     */
    run: async () => {
      const w = window as unknown as { __tentacleSimulateUpdate?: () => void };
      if (!w.__tentacleSimulateUpdate) return "pop-up de mise à jour indisponible";
      w.__tentacleSimulateUpdate();
      return "pop-up de mise à jour affichée — le bouton agit pour de vrai";
    },
  },
  {
    key: "h",
    label: "H · autoriser / interdire la transmission HDR",
    /**
     * Ce que cette bascule fait vraiment, et ce qu'elle ne fait pas.
     *
     * Elle autorise ou interdit à mpv de transmettre le signal HDR
     * (`target-colorspace-hint`). Sur WINDOWS elle entraîne en plus la bascule du
     * mode HDR de l'écran, qui est un interrupteur global du bureau. Sur macOS il
     * n'y a aucun interrupteur : le compositeur accorde la plage étendue fenêtre
     * par fenêtre, à celle qui déclare en avoir l'usage.
     *
     * Le message annonçait « écran en HDR / en SDR » d'après `enabled`, ce qui sur
     * macOS est un EDR INSTANTANÉ dépendant de l'image affichée : une scène de nuit
     * le fait retomber sur une lecture parfaitement HDR. On rapporte donc ce qu'on
     * a changé, et l'état de l'écran seulement là où il en a un.
     */
    run: async () => {
      try {
        const state = await invoke<{ enabled: boolean; autoAutorise: boolean; supporte?: boolean }>(
          "display_hdr_state",
        );
        await invoke("display_hdr_auto", { on: !state.autoAutorise });
        const now = state.autoAutorise ? "interdite" : "autorisée";
        const screen = state.supporte === false
          ? "aucun interrupteur d'écran sur ce système"
          : `écran ${state.enabled ? "en HDR" : "en SDR"}`;
        return `transmission HDR ${now} — ${screen}`;
      } catch {
        return "commande HDR indisponible";
      }
    },
  },
  {
    key: "m",
    label: "M · couper/rallumer le lecteur mpv (repli web)",
    /**
     * L'interrupteur qui permet d'ÉPROUVER le lecteur de secours : coupé, la
     * page route sur le lecteur web comme si mpv n'existait pas — y compris en
     * pleine lecture (WatchDesktop se démonte, mpv_destroy, le web reprend).
     * Persisté : il survit au relancement, pour tester aussi le démarrage.
     */
    run: async () => {
      const { toggleMpvDebug } = await import("../lib/nativePlayer");
      const off = toggleMpvDebug();
      return off
        ? "lecteur mpv COUPÉ — la lecture passe au lecteur web (persiste au relancement)"
        : "lecteur mpv rallumé — effectif à la prochaine lecture";
    },
  },
] as const;
