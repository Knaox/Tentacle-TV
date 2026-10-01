import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { BrandGradient } from "../brand/BrandGradient";
import { Icon } from "../icons/Icon";
import { colors, fonts, white } from "../theme/tokens";
import type { RequestsDockModel } from "./requestTypes";

/**
 * L'APERÇU des demandes en cours, à la place du pictogramme d'une entrée de la
 * navigation (64 × 64) : une affiche s'il n'y en a qu'une ; deux ou trois, en
 * éventail léger, la plus récente devant, et la pastille du nombre au dégradé
 * de la marque s'il y en a plusieurs. Aucune demande : le bac vide, discret,
 * comme un pictogramme du rail. Rien d'animé.
 */

const N = TV_STAGE.nav;
const POSTER = { width: 32, height: 48 };
/** De l'arrière vers l'avant : décalage horizontal et inclinaison de chaque affiche. */
const FAN: Record<number, Array<{ x: number; deg: number }>> = {
  1: [{ x: 0, deg: 0 }],
  2: [{ x: -7, deg: -8 }, { x: 6, deg: 5 }],
  3: [{ x: -11, deg: -11 }, { x: 0, deg: -2 }, { x: 10, deg: 8 }],
};

export const RequestsPeek = memo(function RequestsPeek({ model, dark }: { model: RequestsDockModel; dark: boolean }) {
  const shown = model.posters.slice(0, 3);
  if (shown.length === 0) {
    return (
      <View style={styles.box}>
        <Icon name="inbox" size={N.icon} color={dark ? colors.ctaFg : colors.textSecondary} />
      </View>
    );
  }
  const fan = FAN[shown.length];
  // Dessinées de l'arrière vers l'avant : la plus récente (la première) en dernier.
  const back = [...shown].reverse();
  return (
    <View style={styles.box}>
      {back.map((poster, i) => (
        <View
          key={poster.key}
          style={[styles.poster, { transform: [{ translateX: fan[i].x }, { rotate: `${fan[i].deg}deg` }] }]}
        >
          {poster.uri ? (
            <Image source={{ uri: poster.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
          ) : null}
        </View>
      ))}
      {model.count > 1 ? (
        <View style={styles.badge}>
          <BrandGradient diagonal />
          <Text style={styles.badgeText}>{model.count > 99 ? "99+" : model.count}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { width: N.itemHeight, height: N.itemHeight, alignItems: "center", justifyContent: "center" },
  poster: {
    position: "absolute",
    width: POSTER.width,
    height: POSTER.height,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: white(0.28),
  },
  badge: {
    position: "absolute",
    right: 0,
    bottom: 2,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: white(0.9),
  },
  badgeText: { ...fonts.extrabold, fontSize: 15, color: colors.onAccent, fontVariant: ["tabular-nums"] },
});
