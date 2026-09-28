import { useState } from "react";
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useCardToggles } from "@tentacle-tv/api-client";
import {
  cardExtraLabelKey,
  cardToggleLabelKey,
  type CardOverlay,
  type CardToggleHandlers,
  type CardToggleKind,
  type MediaItem,
} from "@tentacle-tv/shared";
import { ActionCell } from "@/components/ActionCell";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "@/components/cards/cardGlyphs";
import { KeepOfflineActionCell } from "@/offline/entry/KeepOfflineActionCell";
import { SHEET_MAX_WIDTH, spacing, useTheme } from "@/theme";

// expo-haptics optionnel (absent d'Expo Go).
let Haptics: { impactAsync: (style: unknown) => void; ImpactFeedbackStyle: { Medium: unknown } } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* module natif absent */ }

const GAP = 10;
const COLUMNS = 3;

/** La largeur d'une colonne : trois par rangée, dans la feuille (520 au plus). */
function useColumnWidth(): number {
  const { width } = useWindowDimensions();
  const inner = Math.min(width, SHEET_MAX_WIDTH) - spacing.lg * 2;
  return Math.floor((inner - GAP * (COLUMNS - 1)) / COLUMNS);
}

interface Props {
  /** Le titre des bascules et du hors ligne — `null` hors bibliothèque. */
  item: MediaItem | null;
  /** Ce que la feuille offre (`resolveCardOverlay`) : bascules puis extras, dans l'ordre. */
  overlay: Pick<CardOverlay, "toggles" | "extras">;
  /** Bascules fournies par l'appelant (titre lu sur le disque) ; le serveur sinon. */
  handlers?: CardToggleHandlers;
  /** Fermeture animée — le hors ligne ferme la feuille avant son propre dialogue. */
  onClose: () => void;
  /** Extra `details` : la fiche d'une carte dont le tap lance la lecture. */
  onOpenDetails: () => void;
  /** Extra `dismiss` : « Ne plus me proposer ». */
  onDismiss: () => void;
  /** « Gérer » sur cet appareil (titre local), au bout des extras : hors du modèle, propre au mobile. */
  onManage?: () => void;
}

/**
 * Le plateau du survol web, à la taille du doigt : les bascules sur une
 * rangée (Ma liste, favori, vu — l'ordre et les glyphes de la pastille
 * d'états), puis les extras, centrés sur la même grille de trois colonnes
 * (hors ligne, fiche, refus). L'ordre vient du modèle partagé, jamais d'ici.
 */
export function SheetActionGrid({ item, overlay, handlers, onClose, onOpenDetails, onDismiss, onManage }: Props) {
  const { t } = useTranslation(["cards", "offline"]);
  const width = useColumnWidth();
  const cell: ViewStyle = { flex: 0, width };
  const toggleCount = item !== null ? overlay.toggles.length : 0;
  const extraCount = overlay.extras.length + (onManage ? 1 : 0);
  if (toggleCount + extraCount === 0) return null;

  const toggleCells = item !== null && toggleCount > 0 && (handlers ? (
    <ProvidedToggles handlers={handlers} toggles={overlay.toggles} cell={cell} />
  ) : (
    <ServerToggles item={item} toggles={overlay.toggles} cell={cell} />
  ));
  const extraCells = extraCount > 0 && (
    <>
      {overlay.extras.map((extra) => {
        if (extra === "offline") {
          return item ? <KeepOfflineActionCell key={extra} item={item} onClose={onClose} style={cell} /> : null;
        }
        return (
          <ActionCell
            key={extra}
            label={t(`cards:${cardExtraLabelKey(extra)}`)}
            icon={extra === "details" ? "info" : "eye-off"}
            onPress={extra === "details" ? onOpenDetails : onDismiss}
            style={cell}
          />
        );
      })}
      {/* Le glyphe du bouton « ⋯ » des lignes, qui ouvre la même feuille. */}
      {onManage && <ActionCell label={t("offline:manage")} icon="more-horizontal" onPress={onManage} style={cell} />}
    </>
  );

  // Les bascules sur une rangée, les extras sur la suivante — sur UNE seule
  // quand tout tient dans les trois colonnes (un titre local : « vu », Gérer).
  return (
    <View style={st.grid}>
      {toggleCount + extraCount <= COLUMNS ? (
        <View style={st.row}>{toggleCells}{extraCells}</View>
      ) : (
        <>
          {toggleCells && <View style={st.row}>{toggleCells}</View>}
          {extraCells && <View style={st.row}>{extraCells}</View>}
        </>
      )}
    </View>
  );
}

/**
 * Les bascules lues sur le serveur. Composant à part : `useCardToggles` lit
 * les Sets de séries entiers, et une carte hors bibliothèque — ou un titre lu
 * sur le disque — n'a rien à y lire.
 */
function ServerToggles({ item, toggles, cell }: { item: MediaItem; toggles: readonly CardToggleKind[]; cell: ViewStyle }) {
  const state = useCardToggles(item);
  return <ToggleCells toggles={toggles} states={state.states} onToggle={state.toggle} cell={cell} />;
}

/**
 * Les bascules fournies par l'appelant (un titre lu sur le disque). Elles ne
 * vivent pas dans un cache que la feuille relirait : son affichage suit le
 * geste en optimiste, l'appelant écrit (en base locale, de façon synchrone).
 */
function ProvidedToggles({ handlers, toggles, cell }: { handlers: CardToggleHandlers; toggles: readonly CardToggleKind[]; cell: ViewStyle }) {
  const [states, setStates] = useState(handlers.states);
  const onToggle = (kind: CardToggleKind) => {
    setStates((current) => ({ ...current, [kind]: !current[kind] }));
    handlers.onToggle(kind);
  };
  return <ToggleCells toggles={toggles} states={states} onToggle={onToggle} cell={cell} />;
}

interface ToggleCellsProps extends CardToggleHandlers {
  toggles: readonly CardToggleKind[];
  cell: ViewStyle;
}

/** Les cellules des bascules, d'où que viennent leur état et leur geste. */
function ToggleCells({ toggles, states, onToggle, cell }: ToggleCellsProps) {
  const { t } = useTranslation("cards");
  const { colors } = useTheme();
  return (
    <>
      {toggles.map((kind) => {
        const active = states[kind] === true;
        return (
          <ActionCell
            key={kind}
            label={t(cardToggleLabelKey(kind, active))}
            active={active}
            // Le cœur prend l'accent de marque, comme sur la pastille des cartes.
            activeColor={kind === "favorite" ? colors.brand.accent : colors.brand.violet}
            renderIcon={(color) => <ToggleGlyph kind={kind} color={color} filled={active} />}
            onPress={() => {
              Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onToggle(kind);
            }}
            style={cell}
          />
        );
      })}
    </>
  );
}

/** Le glyphe d'une bascule — celui de la pastille d'états, plein quand l'état est vrai. */
function ToggleGlyph({ kind, color, filled }: { kind: CardToggleKind; color: string; filled: boolean }) {
  if (kind === "watchlist") return <BookmarkGlyph size={26} color={color} filled={filled} />;
  if (kind === "favorite") return <HeartGlyph size={26} color={color} filled={filled} />;
  return <WatchedGlyph size={26} color={color} filled={filled} />;
}

const st = StyleSheet.create({
  grid: { paddingHorizontal: spacing.lg, gap: GAP, marginBottom: spacing.lg },
  row: { flexDirection: "row", justifyContent: "center", gap: GAP },
});
