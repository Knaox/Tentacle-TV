import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EyeOff, Info } from "lucide-react";
import { useCardToggles } from "@tentacle-tv/api-client";
import {
  cardExtraLabelKey,
  cardToggleLabelKey,
  type CardOverlay,
  type CardToggleHandlers,
  type CardToggleKind,
  type MediaItem,
} from "@tentacle-tv/shared";
import { CardDownloadAction } from "../../downloads/CardDownloadAction";
import { BookmarkGlyph, HeartGlyph, PlayGlyph, WatchedGlyph } from "./cardGlyphs";
import { CardTrayPrimaryButton } from "./CardTrayPrimaryButton";
import { stopCardClick } from "./cardEvents";

interface CardActionTrayProps {
  /** Le visage Jellyfin des bascules et du hors ligne — `null` hors bibliothèque. */
  item: MediaItem | null;
  /** Ce que le survol offre (`resolveCardOverlay`) : bascules puis extras, dans l'ordre. */
  overlay: Pick<CardOverlay, "toggles" | "extras">;
  /** Nom de la barre d'outils pour les lecteurs d'écran — le titre de la carte. */
  label: string;
  /** `sm` pour les affiches étroites (≤ 140 px), `md` ailleurs. */
  size?: "sm" | "md";
  /** Occupe toute la largeur (affiche) ou épouse son contenu (vignette 16:9). */
  stretch?: boolean;
  /** Extra `details` : ouvrir la fiche d'une carte dont le clic lance la lecture. */
  onOpenDetails?: () => void;
  /** Extra `dismiss` : « Ne plus me proposer ». */
  onDismiss?: () => void;
  /** Bascules d'un titre lu sur le disque : l'état et le geste viennent de l'appelant. */
  localToggles?: CardToggleHandlers;
  /**
   * « Lire » en tête du plateau (`overlay.playInTray`) : le libellé complet
   * (« Reprendre — Dune ») et le geste. Absent : la carte ne lit rien d'ici.
   */
  play?: { label: string; onPlay: () => void } | null;
}

/**
 * Les gabarits des boutons de capsule : une LARGEUR et un carré, jamais une
 * hauteur fixe. Sur une affiche étroite (≤ 160 px), cinq ou six boutons ne
 * tiennent pas à 28 px : ils se resserrent ensemble — `flex-shrink`, la
 * hauteur suit la largeur — au lieu de déborder de la carte. Plancher de
 * 22 px : avec l'écart de 2 px de la capsule, deux centres restent à 24 px,
 * ce que l'exception d'espacement de WCAG 2.5.8 admet ; une affiche de
 * 142 px garde ainsi ses cinq boutons du bureau. Tous les boutons d'une
 * capsule (bascules, action primaire, hors ligne) prennent ce gabarit, et
 * PAS `shrink-0`.
 */
export const TRAY_SIZE = {
  sm: { box: "w-7 min-w-[22px] aspect-square", icon: "h-3.5 w-3.5" },
  md: { box: "w-8 min-w-[22px] aspect-square", icon: "h-4 w-4" },
} as const;

/**
 * Le plateau du survol : « Lire » en tête quand le clic de la carte ne lit
 * pas, puis Ma liste, favori, vu, puis ce que la carte ajoute — hors ligne,
 * fiche, refus d'une recommandation — dans UNE capsule, dans l'ordre que fixe
 * le modèle partagé (`cardOverlay.ts`).
 *
 * « Lire » y est DISCRET (`CardTrayPrimaryButton`, ton `quiet`) : un bouton
 * du gabarit de ses voisins, un verre un peu plus dense, sans couleur. Le
 * gros bouton au dégradé qui trônait au centre de l'image a été retiré.
 *
 * La capsule reprend, dans le même ordre et avec les mêmes glyphes, la
 * pastille d'états du repos : l'état qu'on voyait se retrouve exactement là
 * où on le bascule.
 *
 * Posée sur le voile sombre du survol (≥ 0,9 d'alpha en bas) : pas de
 * `backdrop-filter`, il n'y aurait rien de visible à flouter. Un blanc à 12 %
 * et un liseré suffisent à dessiner le verre.
 */
export function CardActionTray({
  item,
  overlay,
  label,
  size = "md",
  stretch = false,
  onOpenDetails,
  onDismiss,
  localToggles,
  play,
}: CardActionTrayProps) {
  const { t } = useTranslation("cards");
  const { box, icon } = TRAY_SIZE[size];
  const sizes = { box, icon };

  return (
    <CardTrayCapsule label={label} stretch={stretch}>
      {play && (
        <CardTrayPrimaryButton box={box} icon={icon} tone="quiet" label={play.label} onPress={play.onPlay}>
          <PlayGlyph className={icon} />
        </CardTrayPrimaryButton>
      )}
      {overlay.toggles.length > 0 &&
        (localToggles ? (
          <CardTrayToggleButtons toggles={overlay.toggles} handlers={localToggles} {...sizes} />
        ) : item ? (
          <ServerTrayToggles item={item} toggles={overlay.toggles} {...sizes} />
        ) : null)}
      {overlay.extras.map((extra) => {
        if (extra === "offline") {
          // Bureau ET droit, sinon PAS rendu (ni grisé, ni cadenas). Même
          // gabarit rond : il s'aligne dans la capsule comme un bouton de plus.
          return item ? <CardDownloadAction key={extra} item={item} tone="tray" tray={sizes} /> : null;
        }
        const onPress = extra === "details" ? onOpenDetails : onDismiss;
        if (!onPress) return null;
        return (
          <CardTrayButton key={extra} box={box} pressable={false} label={t(cardExtraLabelKey(extra))} onPress={onPress}>
            {extra === "details" ? <Info className={icon} aria-hidden /> : <EyeOff className={icon} aria-hidden />}
          </CardTrayButton>
        );
      })}
    </CardTrayCapsule>
  );
}

interface TogglesProps {
  toggles: readonly CardToggleKind[];
  box: string;
  icon: string;
}

/**
 * Les bascules lues sur le serveur. Composant à part : `useCardToggles`
 * s'abonne aux Sets de séries, et une carte hors bibliothèque — ou lue sur le
 * disque — n'a rien à y lire.
 */
function ServerTrayToggles({ item, ...rest }: TogglesProps & { item: MediaItem }) {
  const state = useCardToggles(item);
  return <CardTrayToggleButtons {...rest} handlers={{ states: state.states, onToggle: state.toggle }} />;
}

/** Les boutons des bascules, quelle que soit la source de leur état. */
function CardTrayToggleButtons({ toggles, box, icon, handlers }: TogglesProps & { handlers: CardToggleHandlers }) {
  const { t } = useTranslation("cards");
  return (
    <>
      {toggles.map((kind) => {
        const active = handlers.states[kind];
        return (
          <CardTrayButton
            key={kind}
            box={box}
            active={active}
            accent={kind === "favorite"}
            label={t(cardToggleLabelKey(kind, active))}
            onPress={() => handlers.onToggle(kind)}
          >
            <ToggleGlyph kind={kind} className={icon} filled={active} />
          </CardTrayButton>
        );
      })}
    </>
  );
}

/** Le glyphe d'une bascule — celui de la pastille d'états du repos. */
export function ToggleGlyph({ kind, className, filled }: { kind: CardToggleKind; className: string; filled: boolean }) {
  if (kind === "watchlist") return <BookmarkGlyph className={className} filled={filled} />;
  if (kind === "favorite") return <HeartGlyph className={className} filled={filled} />;
  return <WatchedGlyph className={className} filled={filled} />;
}

/**
 * La capsule elle-même. Réutilisable par une carte qui n'a pas d'item à
 * basculer mais garde le même plateau — une carte Vigie, par exemple.
 */
export function CardTrayCapsule({ label, stretch = false, children }: { label: string; stretch?: boolean; children: ReactNode }) {
  // `max-w-full min-w-0` : la capsule ne dépasse jamais la carte, ce sont ses
  // boutons qui se resserrent (`TRAY_SIZE`).
  return (
    <div
      role="toolbar"
      aria-label={label}
      onClick={stopCardClick}
      className={`flex min-w-0 max-w-full items-center gap-0.5 rounded-full border border-white/15 bg-white/[0.12] p-0.5 shadow-[0_4px_14px_rgba(0,0,0,0.35)] ${
        stretch ? "w-full justify-between" : ""
      }`}
    >
      {children}
    </div>
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
  label: string;
  onPress: () => void;
  children: ReactNode;
}

export function CardTrayButton({ box, active = false, accent = false, pressable, label, onPress, children }: TrayButtonProps) {
  const isToggle = pressable !== false;
  const tone = active
    ? accent
      ? "bg-white/15 text-[var(--brand-accent)]"
      : "bg-white/15 text-white"
    : "text-white/80 hover:bg-white/10 hover:text-white";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isToggle ? active : undefined}
      title={label}
      onClick={(e) => {
        stopCardClick(e);
        onPress();
      }}
      className={`${box} flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${tone}`}
    >
      {children}
    </button>
  );
}
