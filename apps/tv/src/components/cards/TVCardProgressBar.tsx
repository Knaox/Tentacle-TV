import { View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { BRAND } from "@tentacle-tv/shared";
import { Colors } from "../../theme/colors";
import { TV_CARD_PROGRESS_HEIGHT } from "./cardSizes";

interface TVCardProgressBarProps {
  /** 0–100 inclusive. Returns null below 1 to avoid visual noise. */
  percent: number | null | undefined;
}

/**
 * La barre de progression posée au bas d'une carte.
 *
 * Elle peignait un violet PLAT, sous un commentaire « matches web » devenu
 * faux : le web et le téléviseur LG utilisent `--progress-fill`, le dégradé
 * violet → rose, sur toutes leurs jauges de lecture
 * (`apps/web/src/theme/surfaces.css`). Ce jeton n'existe qu'en CSS — rien côté
 * natif ne peut le lire —, et c'est par là que la dérive est entrée. On
 * reconstruit donc le même dégradé avec les deux bornes de marque, qui elles
 * sont partagées.
 *
 * La lueur (`--progress-glow`) n'est PAS reprise. Une ombre portée coûte cher
 * sur Android — c'est `elevation`, donc un retri du groupe de vues — et il y a
 * une de ces barres par carte visible. Trois pixels de haut n'en valent pas le
 * prix ; le dégradé porte à lui seul la reconnaissance.
 */
export function TVCardProgressBar({ percent }: TVCardProgressBarProps) {
  if (percent == null || percent < 1) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: TV_CARD_PROGRESS_HEIGHT,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
      }}
    >
      <LinearGradient
        colors={[BRAND.violet, Colors.accentPink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          height: TV_CARD_PROGRESS_HEIGHT,
          width: `${Math.min(100, Math.max(0, percent))}%`,
        }}
      />
    </View>
  );
}
