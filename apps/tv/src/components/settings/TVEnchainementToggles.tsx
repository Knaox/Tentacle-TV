import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { Colors, brandAlpha } from "../../theme/colors";
import {
  magasinCarteASuivre,
  magasinDecompteEnchainement,
  useCarteASuivre,
  useDecompteEnchainement,
} from "../../lib/enchainementEpisode";

/**
 * Ce que le lecteur a le droit de faire à la fin d'un épisode.
 *
 * Deux réglages et non un, parce que ce sont deux gestes distincts : montrer la
 * suite, et la lancer. On peut vouloir de l'une sans l'autre — voir la fiche
 * sans jamais partir tout seul est même la combinaison la plus demandée.
 *
 * Pas d'interrupteur à glissière : il n'en existe aucun dans l'application, et
 * un pouce qui coulisse ne veut rien dire sans doigt pour le pousser. Deux
 * boutons, comme le saut d'intro juste au-dessus.
 */

interface ReglageProps {
  titre: string;
  aide: string;
  actif: boolean;
  onChoisir: (actif: boolean) => void;
}

function ReglageDeuxBoutons({ titre, aide, actif, onChoisir }: ReglageProps) {
  const { t } = useTranslation("preferences");

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
        {titre}
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
        {aide}
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
              onPress={() => onChoisir(choix.valeur)}
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

/** La petite fiche « à suivre », proposée pendant le générique de fin. */
export function TVCarteASuivreToggle() {
  const { t } = useTranslation("preferences");
  return (
    <ReglageDeuxBoutons
      titre={t("preferences:upNextCardTitle")}
      aide={t("preferences:upNextCardHint")}
      actif={useCarteASuivre()}
      onChoisir={(actif) => magasinCarteASuivre.definir(actif)}
    />
  );
}

/** L'enchaînement automatique, sur la fiche comme sur l'affiche de fin. */
export function TVDecompteEnchainementToggle() {
  const { t } = useTranslation("preferences");
  return (
    <ReglageDeuxBoutons
      titre={t("preferences:upNextCountdownTitle")}
      aide={t("preferences:upNextCountdownHint")}
      actif={useDecompteEnchainement()}
      onChoisir={(actif) => magasinDecompteEnchainement.definir(actif)}
    />
  );
}
