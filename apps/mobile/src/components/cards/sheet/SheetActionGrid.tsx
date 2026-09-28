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
}

/**
 * Le plateau du survol web, à la taille du doigt : les bascules sur une
 * rangée (Ma liste, favori, vu — l'ordre et les glyphes de la pastille
 * d'états), puis les extras, centrés sur la même grille de trois colonnes
 * (hors ligne, fiche, refus). L'ordre vient du modèle partagé, jamais d'ici.
 */
export function SheetActionGrid({ item, overlay, handlers, onClose, onOpenDetails, onDismiss }: Props) {
  const { t } = useTranslation("cards");
  const width = useColumnWidth();
  const cell: ViewStyle = { flex: 0, width };
  const toggles = item !== null && overlay.toggles.length > 0;
  if (!toggles && overlay.extras.length === 0) return null;

  return (
    <View style={st.grid}>
      {toggles && (handlers ? (
        <ToggleCells toggles={overlay.toggles} states={handlers.states} onToggle={handlers.onToggle} cell={cell} />
      ) : (
        <ServerToggleRow item={item} toggles={overlay.toggles} cell={cell} />
      ))}
      {overlay.extras.length > 0 && (
        <View style={st.row}>
          {overlay.extras.map((extra) => {
            if (extra === "offline") {
              return item ? <KeepOfflineActionCell key={extra} item={item} onClose={onClose} style={cell} /> : null;
            }
            return (
              <ActionCell
                key={extra}
                label={t(cardExtraLabelKey(extra))}
                icon={extra === "details" ? "info" : "eye-off"}
                onPress={extra === "details" ? onOpenDetails : onDismiss}
                style={cell}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

/**
 * Les bascules lues sur le serveur. Composant à part : `useCardToggles` lit
 * les Sets de séries entiers, et une carte hors bibliothèque — ou un titre lu
 * sur le disque — n'a rien à y lire.
 */
function ServerToggleRow({ item, toggles, cell }: { item: MediaItem; toggles: readonly CardToggleKind[]; cell: ViewStyle }) {
  const state = useCardToggles(item);
  return <ToggleCells toggles={toggles} states={state.states} onToggle={state.toggle} cell={cell} />;
}

interface ToggleCellsProps extends CardToggleHandlers {
  toggles: readonly CardToggleKind[];
  cell: ViewStyle;
}

/** La rangée des bascules, d'où que viennent leur état et leur geste. */
function ToggleCells({ toggles, states, onToggle, cell }: ToggleCellsProps) {
  const { t } = useTranslation("cards");
  const { colors } = useTheme();
  return (
    <View style={st.row}>
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
    </View>
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
