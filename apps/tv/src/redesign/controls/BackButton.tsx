import { memo } from "react";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { RoundButton } from "./RoundButton";

/**
 * LE bouton Retour de la refonte, le seul : une croix sur un rond de verre,
 * qui devient blanc au focus et dit « Retour » sous lui. Il remplace toute
 * pilule « Retour », tout « Fermer » — écrans, lecteur, panneaux : un seul
 * dessin, une seule taille, un seul libellé (`common:back`).
 *
 * Où le poser — la règle de position, commune : en HAUT À GAUCHE de ce qu'il
 * referme. Sur un écran, à `BACK_TOP` du haut, sur le bord gauche du contenu
 * (après la navigation quand elle est là) ; dans un panneau, dans son coin.
 *
 * Le focus ne se décide pas ici : la clé (`focusKey`) le nomme à
 * l'intégration, qui ne lui donne JAMAIS l'entrée d'une fiche — sauf quand
 * il est la seule chose à faire.
 */

export const BACK_BUTTON_SIZE = 60;

/** Le haut de la croix sur un écran : son centre sur la ligne de la marque, en haut à droite. */
export const BACK_TOP = TV_STAGE.safe.y + 14;

export interface BackButtonProps {
  focusKey: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

export const BackButton = memo(function BackButton({ focusKey, onPress, onFocusChange }: BackButtonProps) {
  const { t } = useTranslation("common");
  return (
    <RoundButton
      icon="close"
      label={t("back")}
      size={BACK_BUTTON_SIZE}
      focusKey={focusKey}
      onPress={onPress}
      onFocusChange={onFocusChange}
    />
  );
});
