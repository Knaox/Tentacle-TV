import { forwardRef, memo, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { BackIcon } from "../icons/TVIcons";
import { Colors, Fonts, Radius } from "../../theme/colors";
import { FocusRowStyle } from "../../theme/focus";

/**
 * Le bouton « Retour » d'une étagère de la recherche — filmographie, genre,
 * studio. Parité LG (`.tv-search-back`) : la grammaire du retour de la fiche
 * (une pilule, un chevron, « Retour ») sur la surface des pastilles de la
 * recherche (`TVSearchChip`), à la même échelle qu'elles — quatre cinquièmes
 * de la LG.
 *
 * Au focus, le libellé s'éclaire et la pilule se remplit (`--fill-strong`,
 * comme une entrée du rail) ; l'anneau est celui de tous les boutons.
 */
export const TVSearchBack = memo(forwardRef<View, {
  onPress: () => void;
  /** Rien d'autre à viser : page vide, en erreur ou encore en chargement. */
  preferred?: boolean;
  onFocus?: () => void;
}>(function TVSearchBack({ onPress, preferred = false, onFocus }, ref) {
  const { t } = useTranslation("common");
  const [focused, setFocused] = useState(false);
  const tint = focused ? Colors.textPrimary : Colors.textSecondary;
  return (
    <Focusable
      ref={ref}
      variant="button"
      focusRadius={Radius.pill}
      hasTVPreferredFocus={preferred}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      accessibilityLabel={t("back")}
      style={{ alignSelf: "flex-start" }}
    >
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 8,
        height: 52, paddingLeft: 16, paddingRight: 26, borderRadius: Radius.pill,
        borderWidth: 1, borderColor: Colors.glassBorder,
        backgroundColor: focused ? FocusRowStyle.bgColor : Colors.ctaGhostBg,
      }}>
        <BackIcon size={24} color={tint} />
        <Text style={{ color: tint, fontSize: 21, fontWeight: "600", fontFamily: Fonts.semibold }}>
          {t("back")}
        </Text>
      </View>
    </Focusable>
  );
}));
