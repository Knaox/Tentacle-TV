import { Text, View } from "react-native";
import { Focusable } from "../focus/Focusable";
import { Bouton } from "../../theme/boutons";
import { Colors, Typography } from "../../theme/colors";

/**
 * État vide d'une page de collection (Ma liste, Favoris) : une icône SVG, un
 * titre, un indice — jamais d'emoji (contrainte du dépôt) — et **une action**.
 *
 * L'action n'est pas un ornement. Cet écran n'offrait rien de focalisable, au
 * motif que le rail restait la seule sortie ; sur un téléviseur, cela veut dire
 * qu'aucun anneau n'est posé et que la télécommande n'a plus rien à déplacer.
 * Un écran vide n'y est pas sobre, il est mort. La règle vaut aussi bien pour
 * arriver sur une liste vide que pour la vider sous ses propres yeux — le
 * dernier favori retiré démonte la vue qui portait le focus.
 *
 * Elle publie donc aussi la cible d'entrée de l'écran (`entryRef`), pour que la
 * sélection au rail sache où poser l'anneau.
 */
export function TVCollectionEmpty({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action?: {
    libelle: string;
    onPress: () => void;
    entryRef?: (node: View | null) => void;
  };
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 80 }}>
      {icon}
      <Text style={{ color: Colors.textSecondary, ...Typography.sectionTitle }}>{title}</Text>
      <Text style={{ color: Colors.textMuted, fontSize: 16, textAlign: "center", maxWidth: 520 }}>
        {hint}
      </Text>
      {action && (
        <View style={{ marginTop: 16 }}>
          <Focusable
            ref={action.entryRef}
            variant="button"
            focusRadius={Bouton.grand.borderRadius}
            onPress={action.onPress}
            accessibilityLabel={action.libelle}
          >
            <View
              style={{
                ...Bouton.grand,
                paddingHorizontal: 32,
                paddingVertical: 14,
                backgroundColor: Colors.ctaGhostBg,
                borderWidth: 1,
                borderColor: Colors.ctaGhostBorder,
              }}
            >
              <Text style={{ color: Colors.textPrimary, ...Typography.buttonMedium }}>
                {action.libelle}
              </Text>
            </View>
          </Focusable>
        </View>
      )}
    </View>
  );
}
