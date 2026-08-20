import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { Colors, brandAlpha } from "../../theme/colors";
import { magasinSautIntro, useSautIntroAuto } from "../../lib/sautIntroAuto";

/**
 * « Passer l'intro automatiquement », à la télécommande.
 *
 * Pas d'interrupteur à glissière : il n'en existe aucun dans l'application, et
 * un pouce qui coulisse ne veut rien dire sans doigt pour le pousser. Deux
 * boutons, comme la langue d'interface juste au-dessus — celui qui est actif se
 * cerne de la teinte de marque. La grammaire est déjà celle de l'écran.
 */
export function TVSautIntroToggle() {
  const { t } = useTranslation("preferences");
  const actif = useSautIntroAuto();

  return (
    <View style={{ marginBottom: 36 }}>
      <Text
        style={{
          color: Colors.textTertiary,
          fontSize: 13,
          fontWeight: "600",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        {t("preferences:autoSkipIntroTitle")}
      </Text>
      <Text
        style={{
          color: Colors.textTertiary,
          fontSize: 15,
          lineHeight: 22,
          maxWidth: 900,
          marginBottom: 14,
        }}
      >
        {t("preferences:autoSkipIntroHint")}
      </Text>
      <View style={{ flexDirection: "row", gap: 14 }}>
        {[
          { valeur: true, libelle: t("preferences:reglageActive") },
          { valeur: false, libelle: t("preferences:reglageDesactive") },
        ].map((choix) => {
          const choisi = actif === choix.valeur;
          return (
            <Focusable
              key={String(choix.valeur)}
              variant="button"
              scaleOverride={1.04}
              onPress={() => magasinSautIntro.definir(choix.valeur)}
              accessibilityLabel={choix.libelle}
            >
              <View
                style={{
                  minWidth: 160,
                  alignItems: "center",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: choisi ? brandAlpha(0.6) : Colors.glassBorder,
                  backgroundColor: choisi ? brandAlpha(0.18) : "transparent",
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{
                    color: choisi ? Colors.accentPurpleLight : Colors.textPrimary,
                    fontSize: 17,
                    fontWeight: "600",
                  }}
                >
                  {choix.libelle}
                </Text>
              </View>
            </Focusable>
          );
        })}
      </View>
    </View>
  );
}
