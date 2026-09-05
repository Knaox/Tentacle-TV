import { View, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react-native";
import { PLAYER } from "../../theme";

interface StarRatingMobileProps {
  /** Note courante 1..10, null si non noté. */
  value: number | null;
  onRate: (score: number) => void;
  onClear: () => void;
  /** Côté d'une étoile en points (défaut 32 — cible tactile confortable). */
  size?: number;
}

const GAP = 6;

/**
 * Cinq étoiles, dix niveaux — le portage tactile de `StarRating` web : chaque
 * étoile porte DEUX zones de tap (moitiés gauche/droite), re-tap sur la valeur
 * courante = retrait. Tons « sur image » en dur (contours blancs, accent de
 * marque), comme tout ce qui se pose sur l'affiche de fin.
 *
 * Accessibilité RN : le groupe est « adjustable » — un lecteur d'écran monte
 * et descend d'une demi-étoile par geste, les zones de tap lui sont cachées.
 */
export function StarRatingMobile({ value, onRate, onClear, size = 32 }: StarRatingMobileProps) {
  const { t } = useTranslation("reco");

  const pick = (score: number) => {
    if (value === score) onClear();
    else onRate(score);
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t("yourRating")}
      accessibilityValue={{ text: value != null ? t("ratingValue", { score: value }) : "" }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment") {
          onRate(Math.min(10, (value ?? 0) + 1));
        } else if (value != null) {
          if (value <= 1) onClear();
          else onRate(value - 1);
        }
      }}
      style={{ flexDirection: "row", alignItems: "center", gap: GAP }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        // Remplissage de CETTE étoile : 0, 0.5 ou 1 selon la note posée.
        const fraction = Math.min(Math.max((value ?? 0) - (star - 1) * 2, 0), 2) / 2;
        return (
          <View key={star} style={{ width: size, height: size }}>
            <Star
              size={size}
              color="rgba(255,255,255,0.8)"
              strokeWidth={1.5}
              style={{ position: "absolute" }}
            />
            {fraction > 0 && (
              // Moitié (ou totalité) pleine : un cadre rogné sur l'étoile
              // remplie — le clip est STATIQUE, seul le contenu change.
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: fraction === 1 ? size : size / 2,
                  overflow: "hidden",
                }}
              >
                <Star size={size} color={PLAYER.accent} fill={PLAYER.accent} strokeWidth={1.5} />
              </View>
            )}
            <Pressable
              accessible={false}
              onPress={() => pick(star * 2 - 1)}
              hitSlop={{ top: 10, bottom: 10 }}
              style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: size / 2 }}
            />
            <Pressable
              accessible={false}
              onPress={() => pick(star * 2)}
              hitSlop={{ top: 10, bottom: 10 }}
              style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: size / 2 }}
            />
          </View>
        );
      })}
    </View>
  );
}
