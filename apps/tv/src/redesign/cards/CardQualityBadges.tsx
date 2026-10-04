import { Fragment, memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fitQualityBadges, NO_QUALITY_BADGES, type CardMarkers, type QualityBadge } from "@tentacle-tv/shared";
import { FOCUS_HOLD_MS, qualityBadgesShown } from "@tentacle-tv/tv-core";
import { useDwell, Reveal } from "../motion/Reveal";
import { interTextWidth } from "../theme/interMetrics";
import { brandTint, colors, fonts, scrim, white } from "../theme/tokens";
import { MARKER_INSET, RATING_PILL, qualitySlot } from "./cardMarkerGeometry";
import type { CardQuality } from "./cardTypes";
import { useQualityBadges } from "./qualityBadgeSource";

/**
 * Les badges de qualité d'une carte focalisée — « 4K · VISION · ATMOS » —,
 * DANS l'image, en bas à droite : une pastille du verre de la note, sur la
 * même rangée qu'elle (au-dessus de la barre de progression), sans la croiser.
 * Dans le sous-arbre de la cible du focus, comme la note et les épingles :
 * rien ne la recouvre, et la pastille suit la parallaxe de l'image.
 *
 * Les formes courtes du web (« VISION », « ATMOS ») ; ce qui ne tient pas à
 * côté de la note s'en va, en partant de la fin — le 4K d'abord
 * (`fitQualityBadges`). Le 4K seul porte l'accent : une capsule à peine
 * teintée de la marque. Le reste, texte secondaire monochrome.
 *
 * Montés avec l'habit du focus (`CardFrame.focusLayer`) : rien au repos. Ils
 * paraissent AU FOCUS, sans attendre, dès qu'ils sont connus — dans le modèle
 * de la carte, ou déjà lus —, en un fondu bref (tv-core `focus/focusReveal`).
 * Seule la LECTURE d'un titre à lire attend que le focus ait tenu
 * (`FOCUS_HOLD_MS`, `useQualityBadges`) : un focus qui balaie une rangée, ou
 * le défilement rapide, ne demande rien au serveur. Lus, ils paraissent aussitôt.
 */

interface PillSize {
  height: number;
  padding: number;
  gap: number;
  fontSize: number;
  letterSpacing: number;
  capsuleHeight: number;
  capsulePadding: number;
}

/**
 * Deux tailles, les hauteurs de la note : la vignette, et l'affiche
 * (`compact`), serrée pour que « 4K · VISION » tienne à côté d'une note
 * courante (« ★ 8.8 ») sur une affiche de 240 pt, et les trois sans note.
 */
const SIZES: Record<"regular" | "compact", PillSize> = {
  regular: { height: RATING_PILL.height, padding: RATING_PILL.padding, gap: 8, fontSize: 18, letterSpacing: 0.6, capsuleHeight: 28, capsulePadding: 8 },
  compact: { height: RATING_PILL.heightCompact, padding: 9, gap: 6, fontSize: 17, letterSpacing: 0.4, capsuleHeight: 24, capsulePadding: 6 },
};

/** Le liseré de la capsule du 4K, de chaque côté. */
const CAPSULE_BORDER = 1;
/** De quoi absorber l'arrondi du rendu : ce qui est dit tenir tient. */
const FIT_MARGIN = 2;

/** La largeur de la pastille telle que `QualityPill` la dessine. */
function pillWidth(badges: readonly QualityBadge[], size: PillSize): number {
  const dot = interTextWidth("·", size.fontSize, "bold");
  let width = 2 * size.padding;
  badges.forEach((badge, index) => {
    if (index > 0) width += size.gap + (badges[index - 1].accent ? 0 : dot + size.gap);
    const text = interTextWidth(badge.short, size.fontSize, "bold", size.letterSpacing);
    width += badge.accent ? text + 2 * (size.capsulePadding + CAPSULE_BORDER) : text;
  });
  return width;
}

export interface CardQualityBadgesProps {
  quality: CardQuality;
  focused: boolean;
  /** La largeur de l'image. */
  width: number;
  markers: CardMarkers;
  progress?: number;
  /** Une affiche (les petites pastilles de la note) plutôt qu'une vignette. */
  compact: boolean;
  /** Une vignette porte un logo : sans note, il descend jusqu'à la rangée. */
  logo: boolean;
}

export const CardQualityBadges = memo(function CardQualityBadges({ quality, focused, width, markers, progress, compact, logo }: CardQualityBadgesProps) {
  // Le focus a tenu : de quoi LIRE un titre que la liste ne porte pas — jamais de quoi attendre pour montrer.
  const held = useDwell(focused, FOCUS_HOLD_MS);
  const badges = useQualityBadges(quality, held);
  const size = compact ? SIZES.compact : SIZES.regular;
  const slot = useMemo(() => qualitySlot(width, markers, progress, compact, logo), [width, markers, progress, compact, logo]);
  const fitted = useMemo(
    () => (badges ? fitQualityBadges(badges, slot.maxWidth - FIT_MARGIN, (kept) => pillWidth(kept, size)) : NO_QUALITY_BADGES),
    [badges, slot.maxWidth, size],
  );
  return (
    <Reveal shown={qualityBadgesShown({ focused, known: fitted.length > 0 })} style={[styles.anchor, { bottom: slot.bottom }]}>
      <QualityPill badges={fitted} size={size} />
    </Reveal>
  );
});

function QualityPill({ badges, size }: { badges: readonly QualityBadge[]; size: PillSize }) {
  const text = { fontSize: size.fontSize, letterSpacing: size.letterSpacing };
  return (
    <View style={[styles.pill, { height: size.height, borderRadius: size.height / 2, paddingHorizontal: size.padding, gap: size.gap }]}>
      {badges.map((badge, index) => (
        <Fragment key={badge.kind}>
          {index > 0 && !badges[index - 1].accent ? <Text style={[styles.dot, { fontSize: size.fontSize }]}>·</Text> : null}
          {badge.accent ? (
            <View style={[styles.capsule, { height: size.capsuleHeight, borderRadius: size.capsuleHeight / 2, paddingHorizontal: size.capsulePadding }]}>
              <Text style={[styles.token, styles.tokenAccent, text]}>{badge.short}</Text>
            </View>
          ) : (
            <Text style={[styles.token, text]}>{badge.short}</Text>
          )}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", right: MARKER_INSET },
  pill: { flexDirection: "row", alignItems: "center", backgroundColor: scrim(0.72) },
  token: { ...fonts.bold, color: colors.onMediaSecondary },
  tokenAccent: { color: colors.onMedia },
  dot: { ...fonts.bold, color: white(0.45) },
  capsule: {
    justifyContent: "center",
    borderWidth: CAPSULE_BORDER,
    borderColor: brandTint(0.7),
    backgroundColor: brandTint(0.32),
  },
});
