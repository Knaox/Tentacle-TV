import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, EyeOff, Info } from "lucide-react";
import { useCardToggles } from "@tentacle-tv/api-client";
import {
  cardActionEntries,
  type CardActionEntry,
  type CardOverlay,
  type CardToggleKind,
  type CardToggleStates,
  type MediaItem,
} from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "../../../components/cards/cardGlyphs";
import { ActionCell, sheetHaptic, type ActionCellTone } from "./ActionCell";

const NO_STATES: CardToggleStates = { watchlist: false, favorite: false, watched: false };
const TOGGLES: ReadonlySet<CardActionEntry["kind"]> = new Set<CardActionEntry["kind"]>(["watchlist", "favorite", "watched"]);

/**
 * La teinte d'une bascule active — celle de la pastille d'états du repos :
 * le cœur au rose de marque, le signet et la coche au violet. Composantes RVB
 * à part, pour les voiles de l'anneau.
 */
const TONE: Record<CardToggleKind, ActionCellTone> = {
  watchlist: { color: "var(--brand)", rgb: "var(--brand-rgb)" },
  favorite: { color: "var(--brand-accent)", rgb: "var(--brand-accent-rgb)" },
  watched: { color: "var(--brand)", rgb: "var(--brand-rgb)" },
};

/** Le glyphe d'une bascule — celui de la pastille d'états (`cardGlyphs`). */
const GLYPH: Record<CardToggleKind, typeof BookmarkGlyph> = {
  watchlist: BookmarkGlyph,
  favorite: HeartGlyph,
  watched: WatchedGlyph,
};

interface SheetActionsProps {
  /** Le visage Jellyfin des bascules — `null` hors bibliothèque. */
  item: MediaItem | null;
  /** Ce que la carte offre (`resolveCardOverlay`). */
  overlay: CardOverlay;
  /** Extra `details` : la fiche d'une carte dont le toucher lance la lecture. */
  onOpenDetails?: () => void;
  /** Extra `dismiss` : « Ne plus me proposer ». */
  onDismiss?: () => void;
}

/**
 * Ce que la feuille offre sous la lecture, dans l'ordre du modèle
 * (`cardActionEntries`) — celui du plateau du survol web : les bascules en
 * cellules rondes (Ma liste, favori, vu : les glyphes de la pastille d'états,
 * pleins quand l'état est vrai), puis les extras en lignes (« Plus d'infos »,
 * « Ne plus me proposer »). « Garder hors ligne » n'existe pas dans un
 * navigateur : le modèle ne l'offre pas ici.
 */
export function SheetActions({ item, overlay, onOpenDetails, onDismiss }: SheetActionsProps) {
  if (item && overlay.toggles.length > 0) {
    return <ServerSheetActions item={item} overlay={overlay} onOpenDetails={onOpenDetails} onDismiss={onDismiss} />;
  }
  return <SheetActionList overlay={overlay} states={NO_STATES} onOpenDetails={onOpenDetails} onDismiss={onDismiss} />;
}

/**
 * Les bascules lues sur le serveur. Composant à part : `useCardToggles`
 * s'abonne aux Sets de séries ENTIERS — le temps que la feuille est ouverte,
 * jamais au repos.
 */
function ServerSheetActions({ item, ...rest }: Omit<SheetActionsProps, "item"> & { item: MediaItem }) {
  const toggles = useCardToggles(item);
  return <SheetActionList {...rest} states={toggles.states} onToggle={toggles.toggle} />;
}

function SheetActionList({ overlay, states, onToggle, onOpenDetails, onDismiss }: Omit<SheetActionsProps, "item"> & {
  states: CardToggleStates;
  onToggle?: (kind: CardToggleKind) => void;
}) {
  const { t } = useTranslation("cards");
  const entries = cardActionEntries(overlay, states);
  const toggles = entries.filter((entry) => TOGGLES.has(entry.kind));
  const extras = entries.filter((entry) => entry.kind === "details" || entry.kind === "dismiss");

  return (
    <>
      {toggles.length > 0 && onToggle && (
        <div className="flex gap-2.5 px-4 pb-3">
          {toggles.map((entry) => {
            const kind = entry.kind as CardToggleKind;
            const Glyph = GLYPH[kind];
            return (
              <ActionCell
                key={kind}
                label={t(entry.labelKey)}
                active={entry.active === true}
                tone={TONE[kind]}
                onPress={() => onToggle(kind)}
              >
                <Glyph className="h-[26px] w-[26px]" filled={entry.active === true} />
              </ActionCell>
            );
          })}
        </div>
      )}
      {extras.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pb-3">
          {extras.map((entry) => {
            const onPress = entry.kind === "details" ? onOpenDetails : onDismiss;
            if (!onPress) return null;
            return (
              <ExtraRow
                key={entry.kind}
                label={t(entry.labelKey)}
                icon={entry.kind === "details" ? <Info size={18} aria-hidden /> : <EyeOff size={18} aria-hidden />}
                chevron={entry.kind === "details"}
                onPress={onPress}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

/** Une ligne d'extra : icône 18, libellé 15, 48 de haut ; la fiche porte son chevron. */
function ExtraRow({ label, icon, chevron, onPress }: { label: string; icon: ReactNode; chevron: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        sheetHaptic();
        onPress();
      }}
      className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-fill-faint px-3.5 text-left transition-opacity duration-150 active:opacity-75"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <span className="shrink-0 text-content-secondary">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-content-primary">{label}</span>
      {chevron && <ChevronRight size={16} aria-hidden className="shrink-0 text-content-tertiary" />}
    </button>
  );
}
