import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { BrandGradient } from "../brand/BrandGradient";
import { Icon } from "../icons/Icon";
import { colors, fonts, white } from "../theme/tokens";
import { ArrivalArtwork } from "./ArrivalArtwork";
import type { RequestsDockModel } from "./requestTypes";
import { useArrivalPercent } from "./useArrivalPercent";

/**
 * L'APERÇU des demandes en cours, à la place du pictogramme d'une entrée de la
 * navigation (64 × 64) : une affiche s'il n'y en a qu'une ; deux ou trois, en
 * éventail léger, la plus récente devant, et la pastille du nombre au dégradé
 * de la marque s'il y en a plusieurs. Aucune demande : le bac vide, discret,
 * comme un pictogramme du rail.
 *
 * Chaque affiche ARRIVE comme dans la fenêtre (`ArrivalArtwork`) : grise, elle
 * reprend sa couleur au prorata de son avancement ; celle de devant porte le
 * camembert (les autres l'auraient sous elle). Le câblage met devant ce qui
 * bouge : le direct se voit d'un coup d'œil.
 */

const N = TV_STAGE.nav;
const POSTER = { width: 30, height: 45 };
/** Le camembert de l'affiche de devant. */
const SIGN = 18;
/** De l'arrière vers l'avant : décalage horizontal et inclinaison de chaque affiche —
 *  l'éventail tient dans les 64 points du pictogramme, sans toucher le bord du focus. */
const FAN: Record<number, Array<{ x: number; deg: number }>> = {
  1: [{ x: 0, deg: 0 }],
  2: [{ x: -6, deg: -7 }, { x: 5, deg: 5 }],
  3: [{ x: -9, deg: -10 }, { x: 0, deg: -2 }, { x: 8, deg: 7 }],
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
          <PeekPoster poster={poster} front={i === back.length - 1} />
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

/** Une affiche de l'éventail, et son avancement à l'instant. */
function PeekPoster({ poster, front }: { poster: RequestsDockModel["posters"][number]; front: boolean }) {
  const percent = useArrivalPercent(poster.arrival);
  return (
    <ArrivalArtwork
      uri={poster.uri ?? undefined}
      width={POSTER.width}
      height={POSTER.height}
      arrival={poster.arrival}
      percent={percent}
      signSize={front ? SIGN : 0}
    />
  );
}

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
