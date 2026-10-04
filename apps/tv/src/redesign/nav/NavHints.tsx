import { memo } from "react";
import type { SharedValue } from "react-native-reanimated";
import { NavHintLine } from "./NavHintLine";
import { NavLegend, type NavHint } from "./NavLegend";
import { MARGIN_BOTTOM, listEntryCenter, profileCenter, type NavLayout } from "./navGeometry";

/**
 * Les ASTUCES du rail ouvert, à droite des capsules — jamais focalisables,
 * aucune place prise dans la colonne :
 *
 * - pendant un DÉPLACEMENT, la bulle de ses touches (`NavLegend`) ;
 * - sinon, au plus deux lignes courtes (`NavHintLine`) : « Maintenir OK :
 *   organiser » à hauteur de l'entrée organisable focalisée, « ◀ Réglages » à
 *   hauteur du profil (GAUCHE y mène). QUAND, c'est tv-core (`nav/railHint`) :
 *   l'intégration les passe, ou rien.
 */

/** L'écart entre le rail ouvert et ce qui se pose à sa droite. */
export const HINTS_GAP = 20;

export interface NavHintsProps {
  /** Les touches du déplacement en cours. */
  moveHints?: NavHint[];
  organize?: { entryKey: string; label: string } | null;
  settings?: { label: string } | null;
  /** L'index, dans la liste, de l'entrée qu'accompagne « organiser » (-1 : aucune). */
  organizeIndex: number;
  layout: NavLayout;
  /** Le bord gauche : après le rail ouvert. */
  left: number;
  openness: SharedValue<number>;
  listScroll: SharedValue<number>;
  /** Le rail est ouvert (les lignes) ; ou se replie encore (la bulle s'efface avec lui). */
  expanded: boolean;
  labels: boolean;
}

export const NavHints = memo(function NavHints(props: NavHintsProps) {
  const { moveHints, organize, settings, organizeIndex, layout, left, openness, listScroll, expanded, labels } = props;
  return (
    <>
      {/* Rail ouvert, et le temps qu'il se replie : elle passe sur le contenu,
          jamais pendant que le focus y navigue. */}
      {moveHints?.length && labels ? <NavLegend hints={moveHints} openness={openness} left={left} bottom={MARGIN_BOTTOM} /> : null}
      {organize && organizeIndex >= 0 && expanded ? (
        <NavHintLine
          key={organize.entryKey}
          icon="circleDot"
          label={organize.label}
          center={listEntryCenter(layout, organizeIndex)}
          left={left}
          scrollY={listScroll}
        />
      ) : null}
      {settings && expanded ? <NavHintLine icon="chevronLeft" label={settings.label} center={profileCenter(layout)} left={left} /> : null}
    </>
  );
});
