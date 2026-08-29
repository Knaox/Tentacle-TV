import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { Button } from "../../theme/buttons";
import { Colors, Typography } from "../../theme/colors";

/**
 * Une bibliothèque qui ne rend rien — et la sortie qui va avec.
 *
 * Deux situations que l'utilisateur ne vit pas de la même façon, d'où deux
 * réponses. **Filtrée à zéro** : c'est lui qui a fermé la porte, on lui rend la
 * clé (« Réinitialiser »). **Réellement vide** : la bibliothèque n'a rien à
 * montrer, et la seule chose utile est d'aller voir ailleurs.
 *
 * Dans les deux cas il y a un focusable, et c'est le fond du sujet. Le cas qui
 * casse n'est pas d'arriver ici, c'est d'y tomber : filtrer depuis une affiche
 * focalisée démonte la cellule qui portait le focus. Sans rien à reprendre, le
 * D-pad devient muet et il ne reste que le retour arrière.
 *
 * L'en-tête (bannière et barre de filtres) reste au-dessus, et surtout MONTÉ :
 * ce bloc est rendu par la liste elle-même (`ListEmptyComponent`), pas à sa
 * place. Rendu à sa place, il démontait tout l'arbre de la liste — la puce que
 * l'utilisateur venait d'actionner comprise — et le focus partait se perdre
 * dans le rail.
 */
export function TVLibraryEmpty({
  filtered,
  onReset,
  onBrowse,
  entryRef,
}: {
  /** Vrai quand des filtres sont actifs — donc que le vide est réversible. */
  filtered: boolean;
  onReset: () => void;
  onBrowse: () => void;
  entryRef?: (node: View | null) => void;
}) {
  const { t } = useTranslation("common");

  return (
    <View style={{ alignItems: "center", paddingTop: 64, gap: 20 }}>
      <Text style={{ color: Colors.textTertiary, ...Typography.sectionTitle }}>
        {filtered ? t("noResults") : t("emptyLibrary")}
      </Text>
      <Focusable
        ref={entryRef}
        variant="button"
        focusRadius={Button.large.borderRadius}
        onPress={filtered ? onReset : onBrowse}
        accessibilityLabel={filtered ? t("resetFilters") : t("browseLibraries")}
      >
        <View
          style={{
            ...Button.large,
            paddingHorizontal: 32,
            paddingVertical: 14,
            backgroundColor: Colors.ctaGhostBg,
            borderWidth: 1,
            borderColor: Colors.ctaGhostBorder,
          }}
        >
          <Text style={{ color: Colors.textPrimary, ...Typography.buttonMedium }}>
            {filtered ? t("resetFilters") : t("browseLibraries")}
          </Text>
        </View>
      </Focusable>
    </View>
  );
}
