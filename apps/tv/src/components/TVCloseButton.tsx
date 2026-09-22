import { forwardRef } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { TV_PLAYER_PANEL } from "@tentacle-tv/theme";
import { Focusable } from "./focus/Focusable";
import { CloseIcon } from "./icons/TVIcons";
import { Colors } from "../theme/colors";
import { Button } from "../theme/buttons";

/** La cible de la LG : 52 × 52, le plancher des boutons de panneau. */
const SIZE = TV_PLAYER_PANEL.buttonMinHeight;

/**
 * La croix qui referme un menu ou un panneau — la même partout.
 *
 * Retour ferme déjà tout ce qui s'ouvre, mais il faut le savoir : sur un
 * panneau, rien ne le disait. La croix est la sortie VISIBLE, celle que la LG
 * porte déjà sur ses panneaux (`.panneau-tv`, glyphe « × » dans une case de
 * 52 pixels au coin arrondi `radius-sm`) : même forme ici, en tracé plutôt
 * qu'en caractère, dont le dessin changerait avec la police.
 *
 * Un bouton sans texte : son nom passe par `accessibilityLabel`, et c'est
 * l'anneau de focus des boutons qui dit qu'on est dessus.
 */
export const TVCloseButton = forwardRef<View, {
  onPress: () => void;
  /** HAUT depuis la croix → ce focusable (handle natif) : la sortie d'un menu
   *  posé par-dessus une liste, que la géométrie seule ne trouve pas. */
  nextFocusUp?: number;
}>(function TVCloseButton({ onPress, nextFocusUp }, ref) {
  const { t } = useTranslation("common");
  return (
    <Focusable
      ref={ref}
      variant="button"
      focusRadius={Button.small.borderRadius}
      onPress={onPress}
      nextFocusUp={nextFocusUp}
      accessibilityLabel={t("close")}
    >
      <View style={{
        width: SIZE, height: SIZE,
        alignItems: "center", justifyContent: "center",
        ...Button.small,
        backgroundColor: Colors.ctaGhostBg,
      }}>
        <CloseIcon size={26} color={Colors.textSecondary} />
      </View>
    </Focusable>
  );
});
