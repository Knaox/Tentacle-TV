import { invoke } from "../../desktop/bridge";
import { supportsSurfaceProbe } from "../../desktop/capabilities";
import { getLiquidGlass, setLiquidGlass } from "../../theme/liquidGlass";
import { nativeGlassBridge } from "../../theme/liquidGlassMode";
import { probeSurface, probeVerdict } from "../surfaceProbe";
import type { DebugAction, DebugStatus } from "./debugActionTypes";
import { debugShell, liveMpvUnavailable, readMpvProp, toggleMpvProp } from "./debugShell";

interface HdrState {
  enabled: boolean;
  autoAutorise: boolean;
  supporte?: boolean;
}

/** L'état d'une bascule de propriété mpv : sa valeur, ou pourquoi elle ne peut pas agir ici. */
async function liveStatus(name: string, onValue: string): Promise<DebugStatus> {
  const unavailable = liveMpvUnavailable(debugShell());
  if (unavailable !== undefined) return { unavailable };
  const value = await readMpvProp(name);
  return { on: value === onValue, value: value ?? "?" };
}

/** Le groupe « Image et HDR » : ce que l'écran reçoit vraiment. */
export const DISPLAY_ACTIONS: readonly DebugAction[] = [
  {
    id: "hdr-allow",
    key: "h",
    group: "display",
    kind: "switch",
    label: "Transmission HDR autorisée",
    /**
     * Ce que cette bascule fait vraiment : elle autorise ou interdit à la coquille de mettre
     * l'ÉCRAN en HDR pour une lecture HDR. Sur WINDOWS c'est l'interrupteur global du bureau
     * (une à deux secondes de noir) ; sur macOS et Linux il n'y a aucun interrupteur — le
     * compositeur accorde la plage étendue fenêtre par fenêtre. On rapporte ce qu'on a changé,
     * et l'état de l'écran seulement là où il en a un (`enabled` est un EDR instantané sur macOS).
     */
    hint: "Windows : la coquille peut basculer l'écran en HDR pour une lecture HDR. macOS, Linux : aucun interrupteur, la préférence seule est notée.",
    status: async () => {
      if (debugShell().kind === "web") return { unavailable: "pas d'écran à négocier dans un navigateur" };
      try {
        const state = await invoke<HdrState>("display_hdr_state");
        return { on: state.autoAutorise, value: state.supporte === false ? "sans interrupteur" : state.enabled ? "écran HDR" : "écran SDR" };
      } catch {
        return { unavailable: "la coquille ne répond pas à display_hdr_state" };
      }
    },
    run: async () => {
      try {
        const state = await invoke<HdrState>("display_hdr_state");
        await invoke("display_hdr_auto", { on: !state.autoAutorise });
        const screen = state.supporte === false ? "aucun interrupteur d'écran sur ce système" : `écran ${state.enabled ? "en HDR" : "en SDR"}`;
        return `transmission HDR ${state.autoAutorise ? "interdite" : "autorisée"} — ${screen}`;
      } catch {
        return "commande HDR indisponible";
      }
    },
  },
  {
    id: "passthrough",
    key: "p",
    group: "display",
    kind: "switch",
    label: "Passthrough HDR (mpv)",
    // `yes` transmet le signal PQ tel quel — parfait sur un écran en HDR, quasi noir sur un
    // écran SDR ; `no` demande à mpv de convertir.
    hint: "target-colorspace-hint : transmettre le signal tel quel, ou laisser mpv convertir.",
    status: () => liveStatus("target-colorspace-hint", "yes"),
    run: () => toggleMpvProp("target-colorspace-hint", "yes", "no"),
  },
  {
    id: "tone-mapping",
    key: "t",
    group: "display",
    kind: "button",
    label: "Tone-mapping",
    hint: "Alterne st2094-40 et bt.2446a sur la lecture en cours.",
    status: async () => ({ ...(await liveStatus("tone-mapping", "")), on: undefined }),
    run: () => toggleMpvProp("tone-mapping", "st2094-40", "bt.2446a"),
  },
  {
    id: "gamut",
    key: "g",
    group: "display",
    kind: "button",
    label: "Gamut cible",
    hint: "Alterne auto et bt.2020 (target-prim) sur la lecture en cours.",
    status: async () => ({ ...(await liveStatus("target-prim", "")), on: undefined }),
    run: () => toggleMpvProp("target-prim", "auto", "bt.2020"),
  },
  {
    id: "shown",
    key: "i",
    group: "display",
    kind: "button",
    label: "Image affichée",
    // Ce que l'écran reçoit VRAIMENT, par opposition à ce que contient le fichier.
    hint: "Primaires, courbe et pic réellement demandés à la sortie, tone-mapping appliqué.",
    status: () => {
      const shell = debugShell();
      if (shell.kind === "web") return { unavailable: "pas de lecteur mpv dans un navigateur" };
      return {};
    },
    run: async () => {
      const [prim, trc, peak, hint] = await Promise.all([
        readMpvProp("target-prim"), readMpvProp("target-trc"), readMpvProp("target-peak"), readMpvProp("target-colorspace-hint"),
      ]);
      if (prim === null && trc === null && peak === null) return "aucune lecture en cours : rien à lire";
      return `affiché : ${prim ?? "?"} / ${trc ?? "?"} / pic ${peak ?? "?"} · passthrough ${hint ?? "?"}`;
    },
  },
  {
    id: "surface",
    key: "c",
    group: "display",
    kind: "button",
    label: "Capturer la surface",
    // LA question à laquelle aucune propriété ne répond : voit-on quelque chose ? Le natif
    // capture la couche vidéo et compte ses pixels.
    hint: "La coquille capture la couche vidéo et compte ses pixels : image visible, ou aplat noir.",
    status: () => (supportsSurfaceProbe() ? {} : { unavailable: "sonde de surface absente de cette coquille" }),
    run: async () => (supportsSurfaceProbe() ? probeVerdict(await probeSurface()) : "sonde de surface absente de cette coquille"),
  },
  {
    id: "liquid-glass",
    key: "l",
    group: "display",
    kind: "switch",
    label: "Liquid Glass (Tentacle)",
    hint: "Le réglage de Réglages › Apparence, basculé d'ici — utile en pleine lecture, où les réglages sont hors d'atteinte.",
    status: () => (nativeGlassBridge() === null ? { unavailable: "verre natif absent (macOS 26 seulement)" } : { on: getLiquidGlass() }),
    run: async () => {
      if (nativeGlassBridge() === null) return "verre natif absent de cette coquille";
      const next = !getLiquidGlass();
      setLiquidGlass(next);
      return `Liquid Glass ${next ? "allumé" : "coupé"} (réglage de l'appareil)`;
    },
  },
];
