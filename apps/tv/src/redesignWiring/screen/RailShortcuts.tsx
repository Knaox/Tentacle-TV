import { useEffect, useReducer, useState } from "react";
import { Platform, StyleSheet, TVFocusGuideView } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { PROFILE_HEIGHT, PROFILE_TOP, RAIL_TOP } from "../../redesign/nav/navGeometry";
import { navKeyOf } from "../nav/useRailState";
import type { RedesignScreenModel } from "./useRedesignScreen";

/**
 * Les RACCOURCIS de la navigation (tvOS) : les réglages à portée de pouce,
 * même derrière trente bibliothèques. Trois guides invisibles aux bords des
 * capsules, posés seulement pendant que le focus est dans la navigation :
 *
 * - au-dessus du rail : HAUT depuis Rechercher mène au profil — la
 *   navigation BOUCLE ;
 * - au-dessous du profil : BAS depuis le profil mène à Rechercher ;
 * - à gauche : GAUCHE depuis n'importe quelle entrée mène au profil. Le rail
 *   est au bord de l'écran, GAUCHE n'y faisait rien : depuis le contenu,
 *   « gauche, gauche » ouvre ainsi les réglages en deux appuis. La légende
 *   du rail ouvert le dit (« ◀ Profil et réglages »).
 *
 * BAS depuis la dernière entrée rejoint le profil de lui-même (il est
 * dessous). Le guide de gauche ne s'arme qu'après `ARM_AFTER_MS` de focus
 * dans le rail : GAUCHE maintenu pour rejoindre le rail (le pavé répète
 * l'appui) s'arrête sur l'entrée de la page, sans filer jusqu'au profil.
 * Rien pendant l'organisation (menu ouvert, déplacement) : le pavé y a
 * d'autres rôles.
 */

const ARM_AFTER_MS = 450;
const PROFILE = navKeyOf("Settings");
const SEARCH = navKeyOf("Search");
const N = TV_STAGE.nav;

export function RailShortcuts({ screen }: { screen: RedesignScreenModel }) {
  const { focus, railFocused, arrange } = screen;
  const active = railFocused && arrange.heldKey === null && arrange.movingKey === null;
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
    if (!active) return undefined;
    const timer = setTimeout(() => setArmed(true), ARM_AFTER_MS);
    return () => clearTimeout(timer);
  }, [active]);

  // Un guide vise un nœud : se redessiner quand le profil ou Rechercher arrive.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(
    () =>
      focus.subscribeNodes((key) => {
        if (key === PROFILE || key === SEARCH) refresh();
      }),
    [focus],
  );

  if (Platform.OS !== "ios" || !active) return null;
  const profile = focus.node(PROFILE);
  const search = focus.node(SEARCH);
  return (
    <>
      {profile ? <TVFocusGuideView destinations={[profile]} style={styles.above} /> : null}
      {search ? <TVFocusGuideView destinations={[search]} style={styles.below} /> : null}
      {armed && profile ? <TVFocusGuideView destinations={[profile]} style={styles.left} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Entre le haut de l'écran et le rail, sur sa largeur ouverte.
  above: { position: "absolute", left: N.left, width: N.expandedWidth, top: 0, height: RAIL_TOP - 4 },
  // Entre le profil et le bas de l'écran.
  below: { position: "absolute", left: N.left, width: N.expandedWidth, top: PROFILE_TOP + PROFILE_HEIGHT + 4, bottom: 0 },
  // Entre le bord de l'écran et les capsules, sur toute la hauteur.
  left: { position: "absolute", left: 0, width: N.left - 4, top: 0, bottom: 0 },
});
