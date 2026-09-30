import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusGroup } from "../../focus/FocusGroup";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { trayFocusKey, trayGroupKey } from "../cardFocusKeys";
import type { CardTrayAction, CardTrayModel } from "../cardTypes";
import { TRAY, trayButtonSize, trayNoteStarSize, type TrayFace } from "./trayLayout";
import { TrayButton } from "./TrayButton";
import { TrayHint } from "./TrayHint";
import { TrayNote } from "./TrayNote";
import { TRAY_REVEAL_MS } from "./useCardHover";

/**
 * Le plateau d'une carte au focus — le SURVOL du bureau (`CardHoverOverlay`),
 * posé sur la carte comme lui, dans la même grammaire (`cardOverlay.ts`) :
 *   • en bas, la note perso (étoiles, demi-étoiles comprises — un
 *     affichage : elle se pose sur l'échelle de la feuille), puis la capsule —
 *     l'action primaire en tête (« Lire » discret là seulement où OK ne lit
 *     pas, « Demander » au dégradé de marque hors bibliothèque), puis Ma liste
 *     → favori → vu (l'ordre de l'épingle du repos, qui reste visible), puis
 *     les extras (fiche, « Ne plus me proposer ») ;
 *   • centré sur une affiche — et sur l'affiche de la carte qui se redresse —,
 *     rangé dans le coin bas-droit d'une vignette 16:9 ;
 *   • au-dessus, la bulle de ce que fera OK, quand un élément du plateau a le
 *     focus. RIEN au centre de l'image.
 * Le groupe monte de 10 points en fondu (opacité et translation seulement).
 *
 * Télécommande. La carte ouverte s'arrête au-dessus de son plateau
 * (`trayReach`) : rien ne recouvre un focalisable, et la GÉOMÉTRIE seule de
 * tvOS fait déjà le parcours — mesuré au simulateur, focus natif, XCUITest :
 * BAS carte → capsule → rangée suivante (le plateau se referme), HAUT capsule
 * → carte, GAUCHE / DROITE dans la capsule ; aux bouts, elle sort vers la
 * carte voisine. OK sur la carte garde l'action principale (la fiche d'une
 * affiche, la lecture d'une vignette 16:9), l'appui long la feuille
 * d'actions — noter, les infos, Ma liste, j'aime, vu. Le CÂBLAGE n'ajoute,
 * par le port du focus (`focus/focusBinding.tsx` ; `useCardTrayFocus`), que :
 *   • l'entrée sur l'action PRIMAIRE — seule, BAS atterrit sur le bouton le
 *     plus proche : un guide d'entrée lié au groupe `<carte>:tray`, dont la
 *     destination est le premier bouton de la capsule (tvOS entre dans un
 *     guide `autoFocus` par l'élément le plus en haut à gauche, pas par
 *     l'ordre de l'arbre) ;
 *   • s'il le veut, des pièges GAUCHE / DROITE aux bouts de la capsule ;
 *   • Menu, d'où qu'on soit dans le plateau, rend le focus à la carte.
 * Changer de rangée coûte deux BAS quand la carte a un plateau : à éprouver.
 * Clés : le groupe `<carte>:tray` ; les boutons `<carte>:tray:<action>`
 * (`play`, `request`, `watchlist`, `favorite`, `watched`, `details`,
 * `dismiss`).
 */

export interface CardTrayProps {
  tray: CardTrayModel;
  face: TrayFace;
  /** La largeur de la carte, au repos : le plateau s'y resserre. */
  width: number;
  cardKey?: string;
  /** Le titre de la carte : nom de la capsule, et de la lecture. */
  title: string;
  /** Cible du fondu : vrai carte ouverte, faux pendant le fondu de sortie. */
  shown: boolean;
  trayFocus: string | null;
  onTrayFocusChange: (id: string, focused: boolean) => void;
}

const isToggle = (action: CardTrayAction) => action.kind === "watchlist" || action.kind === "favorite" || action.kind === "watched";

export const CardTray = memo(function CardTray({ tray, face, width, cardKey, title, shown, trayFocus, onTrayFocusChange }: CardTrayProps) {
  const p = useFocusProgress(shown, TRAY_REVEAL_MS);
  const rise = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: 10 * (1 - p.value) }] }));
  const corner = face === "landscape";
  const button = trayButtonSize(face, width, tray.actions.length);
  // Pleine largeur sur une affiche quand le plateau est complet ; une capsule
  // d'un ou deux boutons épouse son contenu, au centre (comme au bureau).
  const stretch = !corner && tray.actions.filter(isToggle).length >= 3;
  const focused = trayFocus ? tray.actions.find((candidate) => candidate.kind === trayFocus) : undefined;
  const hint = focused ? (focused.detail ? `${focused.label} · ${focused.detail}` : focused.label) : null;

  const content: ReactNode = (
    <>
      {tray.actions.length > 0 ? (
        <View accessibilityRole="toolbar" accessibilityLabel={title} style={stretch ? styles.stretch : undefined}>
          <GlassSurface radius={button / 2 + TRAY.pad + TRAY.border} tone="clear" style={[styles.capsule, stretch && styles.spread]}>
            {tray.actions.map((action) => (
              <TrayButton
                key={action.kind}
                action={action}
                size={button}
                title={title}
                focusKey={trayFocusKey(cardKey, action.kind)}
                onPress={tray.onAction ? () => tray.onAction?.(action.kind) : undefined}
                onFocusChange={(focused) => onTrayFocusChange(action.kind, focused)}
              />
            ))}
          </GlassSurface>
        </View>
      ) : null}
      {tray.rating ? <TrayNote rating={tray.rating} size={trayNoteStarSize(button)} /> : null}
      {hint ? <TrayHint text={hint} align={corner ? "end" : "center"} /> : null}
    </>
  );
  const inset = TRAY.inset[face];
  const column = [styles.column, corner ? styles.end : styles.center];
  return (
    <Animated.View pointerEvents="box-none" style={[styles.group, { left: inset, right: inset, bottom: TRAY.bottom[face] }, rise]}>
      {cardKey ? (
        <FocusGroup focusKey={trayGroupKey(cardKey)} pointerEvents="box-none" style={column}>{content}</FocusGroup>
      ) : (
        <View pointerEvents="box-none" style={column}>{content}</View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  group: { position: "absolute" },
  // La capsule d'abord dans l'arbre, en bas à l'écran ; la note et la bulle,
  // au-dessus, ne se focalisent pas.
  column: { flexDirection: "column-reverse", gap: TRAY.rowGap },
  center: { alignItems: "center" },
  end: { alignItems: "flex-end" },
  // Le verre de la refonte, ton `clear` (`GlassSurface`) : natif sur tvOS 26,
  // simulé ailleurs, enrichi quand le Liquid Glass est coupé — le
  // `CardTrayCapsule` du bureau, qui n'a qu'une entrée pour tout le verre. Son
  // bord se dessine PAR-DESSUS : la marge intérieure lui garde sa place, les
  // boutons ne bougent pas (`trayButtonSize`).
  capsule: { flexDirection: "row", alignItems: "center", gap: TRAY.gap, padding: TRAY.pad + TRAY.border },
  stretch: { alignSelf: "stretch" },
  spread: { justifyContent: "space-between" },
});
