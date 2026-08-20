import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TV_RADIUS } from "@tentacle-tv/theme";
import { Focusable } from "../focus/Focusable";
import { Colors, brandAlpha } from "../../theme/colors";
import { Bouton } from "../../theme/boutons";

export interface ReglageTv {
  cle: "audio" | "mode" | "sousTitres";
  intitule: string;
  valeur: string;
  choix: Array<{ value: string; label: string }>;
  selection: string | null;
}

/**
 * Les trois réglages de piste d'une bibliothèque — parité `LibraryCardTv`
 * (LG) : une carte (rayon 20, liseré, fond de surface), trois boutons qui
 * disent ce qu'ils règlent et où ils en sont, et « Réinitialiser » SEULEMENT
 * si une préférence existe. Chaque bouton ouvre le panneau de choix — c'est
 * lui qui porte la liste et le confinement du focus.
 */
export function TVLibraryPrefCard({
  nom,
  reglages,
  personnalisee,
  onOuvrir,
  onReinitialiser,
}: {
  nom: string;
  reglages: ReglageTv[];
  personnalisee: boolean;
  onOuvrir: (reglage: ReglageTv) => void;
  onReinitialiser: () => void;
}) {
  const { t } = useTranslation("preferences");

  return (
    <View
      style={{
        borderRadius: TV_RADIUS.lg,
        borderWidth: 1,
        borderColor: brandAlpha(0.22),
        backgroundColor: Colors.bgSurface,
        paddingVertical: 24,
        paddingHorizontal: 28,
      }}
    >
      <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: "600" }}>{nom}</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20 }}>
        {reglages.map((reglage) => (
          <Focusable
            key={reglage.cle}
            variant="button"
            focusRadius={Bouton.moyen.borderRadius}
            scaleOverride={1.04}
            onPress={() => onOuvrir(reglage)}
            accessibilityLabel={`${reglage.intitule} : ${reglage.valeur}`}
          >
            <View
              style={{
                minWidth: 220,
                ...Bouton.moyen,
                borderWidth: 1,
                borderColor: Colors.glassBorder,
                paddingHorizontal: 18,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  color: Colors.textTertiary,
                  fontSize: 13,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                {reglage.intitule}
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: "600", marginTop: 4 }}
              >
                {reglage.valeur}
              </Text>
            </View>
          </Focusable>
        ))}
      </View>

      {personnalisee && (
        <View style={{ flexDirection: "row", marginTop: 20 }}>
          <Focusable variant="button" focusRadius={Bouton.pilule.borderRadius} onPress={onReinitialiser} accessibilityLabel={t("reset")}>
            <View
              style={{
                paddingHorizontal: 22,
                paddingVertical: 11,
                ...Bouton.pilule,
                backgroundColor: Colors.ctaGhostBg,
                borderWidth: 1,
                borderColor: Colors.ctaGhostBorder,
              }}
            >
              <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
                {t("reset")}
              </Text>
            </View>
          </Focusable>
        </View>
      )}
    </View>
  );
}
