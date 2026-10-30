/**
 * Octave mobile — une liste de titres (playlist, « Titres likés ») triée et cherchée par la règle du bureau
 * (`useListOrder`), où l'on GLISSE un titre à sa place par sa poignée — en mode « Modifier » SEULEMENT : hors
 * de ce mode, ni poignée ni glisser, et chaque rangée se balaie. Le glisser et la virtualisation sont ceux de
 * la liste de tri partagée (`ReorderList`, fil d'interface, rangées de hauteur FIXE). La lecture suit l'ordre
 * AFFICHÉ (« Lire » joue ce qu'on voit). La tête de page (`header`) et l'état vide passent en en-tête et pied.
 */

import { useCallback, useMemo, type ReactElement } from "react";
import { AccessibilityInfo } from "react-native";
import { runOnJS, useAnimatedScrollHandler, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { ReorderBlock } from "@tentacle-tv/api-client";
import type { ListRow } from "@tentacle-tv/shared/octave";
import { TRACK_ROW_HEIGHT, usePagesCurrentKey, usePagesPlayer } from "../../pages";
import { playRow } from "../../pages/env/playFrom";
import { closeSwipe } from "../../pages/actions/swipeOpenStore";
import { OCTAVE_TOP_BAR_HEIGHT } from "../../layout/useOctavePageScroll";
import { ReorderList, type ReorderSlot } from "../../reorder/ReorderList";
import { ReorderRow } from "./ReorderRow";

interface Props {
  rows: readonly ListRow[];
  contextId: string;
  gutter: number;
  scrollY: SharedValue<number>;
  header: ReactElement;
  footer?: ReactElement | null;
  bottomInset: number;
  /** `null` : pas de glisser ici (serveur d'avant, liste d'un autre) ; sinon pourquoi il est bloqué, ou rien. */
  reorder: { block: ReorderBlock | null; onMove: (from: number, to: number) => void } | null;
  /** Le mode « Modifier » : la seule porte des poignées. */
  editing: boolean;
  /** Mode « Modifier » d'une playlist modifiable : le « – » de chaque rangée. */
  onRemove?: (row: ListRow) => void;
  /** Mode « Modifier » avec sélection : les rangées cochées (`rowKey`) et le toucher qui coche. */
  selected?: ReadonlySet<string>;
  onToggle?: (rowKey: string) => void;
  /** Place en plus au bas de la liste (la barre de sélection). */
  extraBottom?: number;
  /** Hors « Modifier », là où on peut retirer : le balayage vers la gauche d'une rangée la retire. */
  onSwipeRemove?: (row: ListRow) => void;
}

const rowKeyOf = (row: ListRow) => row.rowKey;
/** La barre de sélection (mode « Modifier ») recouvre le bas de la liste : le défilement part de son bord. */
const SELECTION_BAR_COVER = 64;

export function ReorderableTrackList({ rows, contextId, gutter, scrollY, header, footer, bottomInset, reorder, editing, onRemove, selected, onToggle, extraBottom = 0, onSwipeRemove }: Props) {
  const { t } = useTranslation("musicLists");
  const player = usePagesPlayer();
  const current = usePagesCurrentKey();
  const insets = useSafeAreaInsets();
  const tracks = useMemo(() => rows.map((r) => r.track), [rows]);
  const onScroll = useAnimatedScrollHandler({
    // Défiler referme la rangée balayée ouverte.
    onBeginDrag: () => {
      runOnJS(closeSwipe)();
    },
  });
  const canDrag = editing && reorder !== null && reorder.block === null;
  const onMove = useCallback((from: number, to: number) => reorder?.onMove(from, to), [reorder]);
  // Hors ligne, seuls les titres gardés sur l'appareil partent (la règle de m5, `playFrom`).
  const play = useCallback((index: number) => playRow(player, tracks, index, contextId), [contextId, player, tracks]);
  const announce = useCallback(
    (from: number, to: number) => {
      const title = rows[from]?.track.title ?? "";
      AccessibilityInfo.announceForAccessibility(t("moved", { title, position: to + 1 }));
    },
    [rows, t],
  );
  const toggle = useCallback((index: number) => {
    const row = rows[index];
    if (row) onToggle?.(row.rowKey);
  }, [onToggle, rows]);
  const remove = useCallback((index: number) => {
    const row = rows[index];
    if (row) onRemove?.(row);
  }, [onRemove, rows]);
  const swipeRemove = useCallback((index: number) => {
    const row = rows[index];
    if (row) onSwipeRemove?.(row);
  }, [onSwipeRemove, rows]);

  const extraData = useMemo(() => [current, selected], [current, selected]);
  const renderRow = useCallback(
    (item: ListRow, index: number, slot: ReorderSlot) => (
      <ReorderRow
        track={item.track}
        index={index}
        list={tracks}
        contextId={contextId}
        playing={current === item.track.key}
        onPlay={play}
        gutter={gutter}
        slot={slot}
        onRemove={onRemove ? remove : undefined}
        editing={editing}
        selected={selected?.has(item.rowKey) ?? false}
        onToggle={onToggle ? toggle : undefined}
        onSwipeRemove={onSwipeRemove && !editing ? swipeRemove : undefined}
      />
    ),
    [contextId, current, editing, gutter, onRemove, onSwipeRemove, onToggle, play, remove, selected, swipeRemove, toggle, tracks],
  );
  const edgeInsets = useMemo(
    () => ({ top: insets.top + OCTAVE_TOP_BAR_HEIGHT, bottom: Math.max(0, bottomInset - 24) + (extraBottom > 0 ? SELECTION_BAR_COVER : 0) }),
    [bottomInset, extraBottom, insets.top],
  );
  const scrollProps = useMemo(() => ({ contentContainerStyle: { paddingBottom: bottomInset + extraBottom } }), [bottomInset, extraBottom]);

  return (
    <ReorderList
      data={rows}
      keyOf={rowKeyOf}
      rowHeight={TRACK_ROW_HEIGHT}
      renderRow={renderRow}
      onMove={canDrag ? onMove : null}
      scrollY={scrollY}
      onScroll={onScroll}
      scrollProps={scrollProps}
      header={header}
      footer={footer ?? null}
      edgeInsets={edgeInsets}
      extraData={extraData}
      onStepped={announce}
    />
  );
}
