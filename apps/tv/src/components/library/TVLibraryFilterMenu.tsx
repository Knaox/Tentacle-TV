import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { TVFocusGuideView } from "react-native";
import Svg, { Path } from "react-native-svg";
import { TV_OVERSCAN_PT, TV_RADIUS, TV_SHADOW } from "@tentacle-tv/theme";
import { Focusable } from "../focus/Focusable";
import { RAIL_COLLAPSED } from "../nav/TVSideRail";
import { Colors, brandAlpha } from "../../theme/colors";

/** Largeur minimale d'un panneau, à trois mètres (`FilterMenuTv` webOS). */
export const MENU_MIN_WIDTH = 380;

export interface MenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Le panneau d'un menu de filtre — la primitive commune (tri, genres, années,
 * note, plateformes). Règles héritées de la LG (`FilterMenuTv`) :
 *
 *  - le PIÈGE de focus est sur la racine du panneau (autoFocus + trapFocus
 *    des quatre côtés) : le D-pad ne s'échappe pas vers la grille pendant que
 *    le panneau est affiché ;
 *  - on entre par l'option COCHÉE (chaque ligne pose `hasTVPreferredFocus`
 *    sur son état coché), TOUT DE SUITE — sauf si `autoFocus` est coupé
 *    (menu des années : deux champs de saisie, rien ne doit faire monter un
 *    clavier sans un geste explicite) ;
 *  - choisir une option NE FERME PAS le menu (genres et plateformes se
 *    cochent en série) ; la fermeture est le Retour, géré par l'écran.
 *
 * Positionné sous son déclencheur : les coordonnées d'ancrage sont mesurées
 * en fenêtre (`measureInWindow`), le panneau vit dans le cadre padté de
 * l'écran — on retranche l'origine du cadre, qui est constante.
 */
export function TVLibraryFilterMenu({
  anchor,
  autoFocus = true,
  width = MENU_MIN_WIDTH,
  children,
}: {
  anchor: MenuAnchor;
  autoFocus?: boolean;
  width?: number;
  children: React.ReactNode;
}) {
  const { width: windowW } = useWindowDimensions();
  const contentW = windowW - RAIL_COLLAPSED - TV_OVERSCAN_PT.x;
  const left = Math.min(Math.max(0, anchor.x - RAIL_COLLAPSED), Math.max(0, contentW - width));
  const top = anchor.y + anchor.height + 8 - TV_OVERSCAN_PT.y;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
    >
      <TVFocusGuideView
        autoFocus={autoFocus}
        trapFocusUp
        trapFocusDown
        trapFocusLeft
        trapFocusRight
        style={{
          position: "absolute",
          top,
          left,
          width,
          maxHeight: 520,
          borderRadius: TV_RADIUS.lg,
          // `--surface-dropdown` du thème TV (tokens/tv.ts).
          backgroundColor: "#14141a",
          borderWidth: 1,
          borderColor: Colors.glassBorder,
          paddingVertical: 10,
          paddingHorizontal: 10,
          ...TV_SHADOW.elev3,
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </TVFocusGuideView>
    </View>
  );
}

/** Une ligne cochable — gabarit des menus de la LG : hauteur ≥ 46, texte 18,
 *  coche 22. `preferred` = l'option cochée reçoit le focus à l'ouverture. */
export function TVCheckRow({
  label,
  checked,
  preferred,
  onPress,
}: {
  label: string;
  checked: boolean;
  preferred?: boolean;
  onPress: () => void;
}) {
  return (
    <Focusable
      variant="button"
      onPress={onPress}
      hasTVPreferredFocus={preferred}
      accessibilityLabel={label}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minHeight: 46,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: checked ? brandAlpha(0.16) : "transparent",
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            borderWidth: checked ? 0 : 1,
            borderColor: Colors.glassBorder,
            backgroundColor: checked ? Colors.accentPurple : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checked && (
            <Svg width={14} height={14} viewBox="0 0 20 20" fill="#ffffff">
              <Path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </Svg>
          )}
        </View>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 18,
            color: checked ? Colors.accentPurpleLight : Colors.textSecondary,
          }}
        >
          {label}
        </Text>
      </View>
    </Focusable>
  );
}
