import { createContext, useContext, type ReactNode } from "react";
import type { CardTrayExtra } from "@tentacle-tv/shared";

import { stopCardClick } from "./cardEvents";
import { GLASS_LENS_PROPS, useLiquidGlassMode, useLiquidGlassSurface } from "../../theme/glass";

/** Faux dans la mini-carte d'aperçu (`bare`) : ses ronds ont leur propre peau. */
const TrayGlass = createContext(true);

/** Le plateau porte-t-il ses boutons en verre ? (faux dans l'aperçu) */
export const useTrayGlassAllowed = (): boolean => useContext(TrayGlass);

/**
 * La capsule elle-même. Réutilisable par une carte qui n'a pas d'item à
 * basculer mais garde le même plateau — une carte Vigie, par exemple.
 *
 * `bare` : sans capsule (la mini-carte d'aperçu, où chaque bouton est un rond
 * cerclé) — la barre d'outils reste, son nom et son arrêt des clics aussi.
 * Seul un bouton qui rend son clic à la carte (`data-tray-pass`) le laisse
 * passer.
 *
 * Verre natif (macOS 26) : la capsule n'est plus qu'un GROUPE transparent —
 * chaque bouton est sa propre pastille de verre clair qui flotte sur
 * l'affiche (`CardTrayButton`), un peu plus écartées pour se lire séparées.
 */
export function CardTrayCapsule({ label, stretch = false, bare = false, children }: {
  label: string;
  stretch?: boolean;
  bare?: boolean;
  children: ReactNode;
}) {
  const native = useLiquidGlassMode() === "native";
  // `max-w-full min-w-0` : la capsule ne dépasse jamais la carte, ce sont ses
  // boutons qui se resserrent (`TRAY_SIZE`).
  const layout = `flex min-w-0 max-w-full items-center p-0.5 ${stretch ? "w-full justify-between" : ""}`;
  const capsule = native
    ? `${layout} gap-1.5`
    : `${layout} gap-0.5 rounded-full border border-white/15 bg-white/[0.12] shadow-[0_4px_14px_rgba(0,0,0,0.35)]`;
  return (
    <TrayGlass.Provider value={!bare}>
      <div
        role="toolbar"
        aria-label={label}
        onClick={(e) => {
          if (!(e.target instanceof Element && e.target.closest("[data-tray-pass]"))) stopCardClick(e);
        }}
        className={bare ? "card-preview-tray" : capsule}
      >
        {children}
      </div>
    </TrayGlass.Provider>
  );
}

interface TrayButtonProps {
  box: string;
  /** État d'une bascule — absent pour une action simple (fiche, refus). */
  active?: boolean;
  /** L'état actif prend l'accent de marque (le cœur) plutôt que le blanc. */
  accent?: boolean;
  /** Faux : une action, pas une bascule — pas d'`aria-pressed`. */
  pressable?: boolean;
  /** L'extra que ce bouton porte (`data-tray-extra`) : la feuille de la mini-carte range « Plus d'infos » au bout. */
  extra?: CardTrayExtra;
  label: string;
  /** Absent : le clic REMONTE à la carte, qui fait son geste (« Plus d'infos » d'une affiche). */
  onPress?: () => void;
  children: ReactNode;
}

/**
 * Un bouton du plateau. Verre natif : une pastille RONDE de verre clair, sa
 * lentille calculée pour le cercle, ses glyphes adaptés à l'affiche dessous
 * (`data-lg-tone`), éclairée au survol, gonflée à l'appui (lentille de
 * lg-physique) ; allumée (Ma liste, vu, favori), la teinte passe DANS le verre.
 * Ailleurs : le rendu d'avant (`fallbackClassName`).
 */
export function CardTrayButton({ box, active = false, accent = false, pressable, extra, label, onPress, children }: TrayButtonProps) {
  const isToggle = pressable !== false;
  const tone = active
    ? accent
      ? "bg-white/15 text-[var(--brand-accent)]"
      : "bg-white/15 text-white"
    : "text-white/80 hover:bg-white/10 hover:text-white";
  const layout = `${box} flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`;
  const skin = `rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 ${tone}`;
  const glassAllowed = useContext(TrayGlass);
  const glass = useLiquidGlassSurface({
    level: active ? "tinted" : "clear",
    tint: accent ? "accent" : "brand",
    shape: "circle",
    interactive: true,
    className: layout,
    fallbackClassName: skin,
  });
  // Hors du verre (aperçu) : la surface n'est pas branchée — ni mesure, ni filtre.
  const surface = glassAllowed ? glass.props : { className: `${layout} ${skin}` };
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isToggle ? active : undefined}
      title={label}
      {...GLASS_LENS_PROPS}
      {...surface}
      data-tray-extra={extra}
      data-tray-pass={onPress ? undefined : true}
      onClick={(e) => {
        if (!onPress) return;
        stopCardClick(e);
        onPress();
      }}
    >
      {glassAllowed && glass.layers}
      {children}
    </button>
  );
}
