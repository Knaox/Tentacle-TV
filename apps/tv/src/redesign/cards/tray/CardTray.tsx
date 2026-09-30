import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { FocusGroup } from "../../focus/FocusGroup";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { white } from "../../theme/tokens";
import { starOf, trayFocusKey, trayGroupKey } from "../cardFocusKeys";
import type { CardTrayAction, CardTrayModel } from "../cardTypes";
import { TRAY, trayButtonSize, trayStarSize, type TrayFace } from "./trayLayout";
import { TrayButton } from "./TrayButton";
import { TrayHint } from "./TrayHint";
import { TrayStars } from "./TrayStars";
import { TRAY_REVEAL_MS } from "./useCardHover";

/**
 * Le plateau d'une carte au focus — le SURVOL du bureau (`CardHoverOverlay`),
 * posé sur la carte comme lui, dans la même grammaire (`cardOverlay.ts`) :
 *   • en bas, les étoiles (la note, entières), puis la capsule — l'action
 *     primaire en tête (« Lire » discret là seulement où OK ne lit pas,
 *     « Demander » à l'ambre hors bibliothèque), puis Ma liste → favori → vu
 *     (l'ordre de la pastille du repos), puis les extras (fiche, « Ne plus me
 *     proposer ») ;
 *   • centré sur une affiche — et sur l'affiche de la carte qui se redresse —,
 *     rangé dans le coin bas-droit d'une vignette 16:9 ;
 *   • au-dessus, la bulle de ce que fera OK, quand un élément du plateau a le
 *     focus. RIEN au centre de l'image.
 * Le groupe monte de 10 points en fondu (opacité et translation seulement).
 *
 * Télécommande — proposée ici, posée par le CÂBLAGE à travers le port du focus
 * (`focus/focusBinding.tsx`), jamais dans la vue :
 *   • OK sur la carte garde l'action principale (la fiche d'une affiche, la
 *     lecture d'une vignette 16:9) ; l'appui long garde la feuille d'actions ;
 *   • BAS depuis la carte entre dans le plateau par son action PRIMAIRE : un
 *     guide `autoFocus` lié au groupe `<carte>:tray`, dont la capsule vient la
 *     PREMIÈRE dans l'arbre (affichée en bas : `column-reverse`) ;
 *   • GAUCHE / DROITE parcourent la capsule, bornés (pièges du guide) ;
 *   • HAUT remonte d'un rang : de la capsule aux étoiles, des étoiles à la
 *     carte (`nextFocusUp` sur les étoiles, vers la ref de `<carte>`) ; sans
 *     étoiles, la capsule rend le focus à la carte ;
 *   • Menu, d'où qu'on soit dans le plateau, rend le focus à la carte ;
 *   • BAS depuis la capsule quitte la carte vers la rangée suivante — le
 *     plateau se referme. Changer de rangée coûte donc deux BAS : à éprouver
 *     à la télécommande.
 * Clés : le groupe `<carte>:tray` ; les boutons `<carte>:tray:<action>`
 * (`play`, `request`, `watchlist`, `favorite`, `watched`, `details`,
 * `dismiss`) ; les étoiles `<carte>:tray:star:<1…5>`.
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
  const { t } = useTranslation("reco");
  const p = useFocusProgress(shown, TRAY_REVEAL_MS);
  const rise = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: 10 * (1 - p.value) }] }));
  const corner = face === "landscape";
  const button = trayButtonSize(face, width, tray.actions.length);
  // Pleine largeur sur une affiche quand le plateau est complet ; une capsule
  // d'un ou deux boutons épouse son contenu, au centre (comme au bureau).
  const stretch = !corner && tray.actions.filter(isToggle).length >= 3;
  const focusedStar = starOf(trayFocus);

  let hint: { text: string; danger?: boolean } | null = null;
  if (focusedStar !== null) {
    const current = tray.rating?.current ?? null;
    hint = current === focusedStar * 2
      ? { text: t("removeRatingAria", { score: current }), danger: true }
      : { text: t("rateAria", { score: focusedStar * 2 }) };
  } else if (trayFocus) {
    const action = tray.actions.find((candidate) => candidate.kind === trayFocus);
    if (action) hint = { text: action.detail ? `${action.label} · ${action.detail}` : action.label };
  }

  const content: ReactNode = (
    <>
      {tray.actions.length > 0 ? (
        <View accessibilityRole="toolbar" accessibilityLabel={title} style={[styles.capsule, stretch && styles.stretch]}>
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
        </View>
      ) : null}
      {tray.rating ? (
        <TrayStars
          rating={tray.rating}
          size={trayStarSize(button)}
          focusedStar={focusedStar}
          cardKey={cardKey}
          onRate={tray.onRate}
          onFocusChange={onTrayFocusChange}
        />
      ) : null}
      {hint ? <TrayHint text={hint.text} danger={hint.danger} align={corner ? "end" : "center"} /> : null}
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
  // La capsule d'abord dans l'arbre, en bas à l'écran : un guide `autoFocus`
  // entre ainsi dans le plateau par son action primaire.
  column: { flexDirection: "column-reverse", gap: TRAY.rowGap },
  center: { alignItems: "center" },
  end: { alignItems: "flex-end" },
  // Posée sur le voile (0,9 en bas) : pas de flou, un blanc à 12 % et un
  // liseré suffisent à dessiner le verre — le `CardTrayCapsule` du bureau.
  capsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: TRAY.gap,
    padding: TRAY.pad,
    borderRadius: 999,
    borderWidth: TRAY.border,
    borderColor: white(0.15),
    backgroundColor: white(0.12),
  },
  stretch: { alignSelf: "stretch", justifyContent: "space-between" },
});
