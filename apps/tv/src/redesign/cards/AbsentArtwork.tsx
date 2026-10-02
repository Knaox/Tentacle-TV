import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { MY_TITLE_PERCENT_KEY } from "@tentacle-tv/shared";
import { SoftGradient } from "../background/SoftGradient";
import { ProgressPie } from "../brand/ProgressPie";
import { useFocusProgress } from "../focus/useFocusProgress";
import { Icon, type IconName } from "../icons/Icon";
import { ArrivalArtwork } from "../requests/ArrivalArtwork";
import type { ArrivalModel, ArrivalState } from "../requests/arrivalTypes";
import { useArrivalPercent } from "../requests/useArrivalPercent";
import { colors, fonts, scrim, white } from "../theme/tokens";
import type { AbsentModel, AbsentTone } from "./cardTypes";
import { GreyscaleImage } from "./GreyscaleImage";

/**
 * Le visage d'un titre ABSENT de la bibliothèque, dans le cadre de sa carte :
 * son affiche (TMDB) en niveaux de gris, sous un voile qui l'assombrit — et
 * s'allège au focus, sans rien redessiner (opacité seule) —, puis son badge en
 * bas à gauche, là où une carte de la bibliothèque porte sa note. Sans
 * affiche (serveur plus ancien, titre sans image chez TMDB) : un cadre qui
 * écrit le titre et l'année, jamais une fausse affiche.
 *
 * Le badge dit « Pas dans la bibliothèque », ou l'état que l'extension donne
 * du titre ; le ton choisit la couleur et le glyphe, le texte porte toujours
 * le sens.
 *
 * Un titre que le COMPTE a demandé (`absent.arrival`) arrive façon Apple
 * (`ArrivalArtwork`) : l'affiche grise reprend sa couleur au prorata de
 * l'avancement, le camembert au centre — le signe de l'état, à sa place —, et
 * le badge dit le mot, avec le pour cent qui avance à la même seconde.
 */

/** Le voile : au repos, l'affiche recule ; au focus, elle se lit. Sur un cadre
 *  sans affiche, plus léger : le titre écrit doit se lire au repos. */
const VEIL = { image: { rest: 0.42, focused: 0.16 }, lettered: { rest: 0.22, focused: 0 } };
/** Le badge, au pied de l'image : la place de la note sur les autres cartes. */
const BADGE_INSET = 12;
/** Le camembert d'une demande en cours, dans un badge (état de l'extension). */
const PIE_SIZE = 34;
/** Le camembert au centre d'une affiche demandée : cette part de sa largeur. */
const SIGN_RATIO = 0.28;

const TONE_COLOR: Record<AbsentTone, string> = {
  neutral: white(0.92),
  pending: colors.accentLight,
  active: colors.accentLight,
  ready: colors.successFg,
  blocked: colors.warningFg,
};

const TONE_GLYPH: Partial<Record<AbsentTone, IconName>> = {
  pending: "clock",
  ready: "check",
  blocked: "alert",
};

/** Le mot d'une demande du compte : sa couleur suit l'état (jamais seule : le signe est au centre). */
const ARRIVAL_COLOR: Record<ArrivalState, string> = {
  pending: colors.accentLight,
  arriving: colors.text,
  importing: colors.accentLight,
  blocked: colors.warningFg,
  arrived: colors.successFg,
};

const Badge = memo(function Badge({ absent, maxWidth }: { absent: AbsentModel; maxWidth: number }) {
  const color = TONE_COLOR[absent.tone];
  const glyph = TONE_GLYPH[absent.tone];
  // En cours, avancement su : le camembert de la marque et son pour cent,
  // façon App Store — le mot reste dit aux lecteurs d'écran.
  if (absent.tone === "active" && absent.progress !== undefined) {
    return (
      <View style={[styles.badge, { maxWidth }]} accessibilityLabel={absent.label}>
        <ProgressPie percent={absent.progress * 100} size={PIE_SIZE} />
      </View>
    );
  }
  return (
    <View style={[styles.badge, { maxWidth }]}>
      {absent.tone === "active" ? <ProgressPie percent={null} size={PIE_SIZE} showValue={false} /> : null}
      {glyph ? <Icon name={glyph} size={20} color={color} strokeWidth={2.4} /> : null}
      <Text style={[styles.badgeText, { color }]} numberOfLines={2}>{absent.label}</Text>
    </View>
  );
});

/** Le badge d'une demande du compte : le mot, puis le pour cent à l'instant. */
function ArrivalBadge({ arrival, label, percent, maxWidth }: { arrival: ArrivalModel; label: string; percent: number | null; maxWidth: number }) {
  const { t } = useTranslation();
  const value = arrival.state === "arriving" && percent !== null ? t(MY_TITLE_PERCENT_KEY, { percent: Math.floor(percent) }) : null;
  return (
    <View style={[styles.badge, { maxWidth }]}>
      <Text style={[styles.badgeText, { color: ARRIVAL_COLOR[arrival.state] }]} numberOfLines={2}>
        {label}
        {value ? <Text style={styles.badgePercent}>{` · ${value}`}</Text> : null}
      </Text>
    </View>
  );
}

/** Le cadre d'un titre sans affiche : son nom et son année, écrits. */
function Lettered({ title, year, width, height }: { title: string; year?: string; width: number; height: number }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <SoftGradient width={width} height={height} colors={[white(0.1), white(0.03)]} />
      <View style={styles.lettered}>
        <Icon name="film" size={34} color={white(0.42)} />
        <View style={styles.letteredText}>
          <Text style={styles.letteredTitle} numberOfLines={4}>{title}</Text>
          {year ? <Text style={styles.letteredYear}>{year}</Text> : null}
        </View>
      </View>
    </View>
  );
}

interface ArtworkProps {
  absent: AbsentModel;
  uri?: string;
  title: string;
  year?: string;
  width: number;
  height: number;
  focused: boolean;
}

/** Une demande du compte : l'affiche qui arrive, son camembert, son mot. */
function Arriving({ absent, arrival, uri, title, year, width, height, focused }: ArtworkProps & { arrival: ArrivalModel }) {
  const percent = useArrivalPercent(arrival);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <ArrivalArtwork
        uri={uri}
        width={width}
        height={height}
        arrival={arrival}
        percent={percent}
        signSize={Math.round(width * SIGN_RATIO)}
        veil={uri ? VEIL.image : VEIL.lettered}
        focused={focused}
        placeholder={<Lettered title={title} year={year} width={width} height={height} />}
      />
      <ArrivalBadge arrival={arrival} label={absent.label} percent={percent} maxWidth={width - 2 * BADGE_INSET} />
    </View>
  );
}

function Grey({ absent, uri, title, year, width, height, focused }: ArtworkProps) {
  const p = useFocusProgress(focused);
  const { rest, focused: lit } = uri ? VEIL.image : VEIL.lettered;
  const veil = useAnimatedStyle(() => ({ opacity: rest + (lit - rest) * p.value }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {uri ? <GreyscaleImage uri={uri} width={width} height={height} /> : <Lettered title={title} year={year} width={width} height={height} />}
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veil]} />
      <Badge absent={absent} maxWidth={width - 2 * BADGE_INSET} />
    </View>
  );
}

export const AbsentArtwork = memo(function AbsentArtwork(props: ArtworkProps) {
  const arrival = props.absent.arrival;
  return arrival ? <Arriving {...props} arrival={arrival} /> : <Grey {...props} />;
});

const styles = StyleSheet.create({
  veil: { backgroundColor: scrim(1) },
  badge: {
    position: "absolute",
    left: BADGE_INSET,
    bottom: BADGE_INSET,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: scrim(0.72),
  },
  badgeText: { ...fonts.bold, fontSize: 22, lineHeight: 27, flexShrink: 1 },
  badgePercent: { fontVariant: ["tabular-nums"] },
  // Le titre en haut, sous le pictogramme : le pied appartient au badge.
  lettered: { flex: 1, padding: 22, gap: 16 },
  letteredText: { gap: 6 },
  letteredTitle: { ...fonts.bold, fontSize: 26, lineHeight: 31, color: white(0.78) },
  letteredYear: { ...fonts.medium, fontSize: 22, color: colors.textSecondary },
});
