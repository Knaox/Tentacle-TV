import { memo, useMemo, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { SoftGradient } from "../background/SoftGradient";
import { useFocusProgress } from "../focus/useFocusProgress";
import type { RowPlace } from "../motion/useRowRecede";
import { colors, fonts, scrim } from "../theme/tokens";
import { AbsentArtwork } from "./AbsentArtwork";
import { CardBadge } from "./CardBadge";
import { CardFocusFooter, cardFocusFooterHeight } from "./CardFocusFooter";
import { CardFrame, cardGlowOf } from "./CardFrame";
import { CardShell } from "./CardShell";
import { CardMarkerLayer } from "./CardMarkerLayer";
import { cardLogoBottom, LOGO_BOX } from "./cardMarkerGeometry";
import { CardPreviewTile, UnderPreviewTile, useCardGrowth, useDrivenCardGrowth, type CardGrowth, type CardGrowthDriver } from "./CardPreviewTile";
import { CardQualityBadges } from "./CardQualityBadges";
import type { CardModel } from "./cardTypes";
import { useCardFocused, type CardFocused } from "./useCardFocused";
import { CARD_FOCUS_SCALE } from "./cardFocus";
import { useCardMetrics } from "./cardSizeMode";

/**
 * La carte d'un titre — deux formats, un seul modèle :
 * - `landscape` (16:9) : image Thumb/Backdrop, logo du titre posé dessus
 *   quand l'image n'en porte pas ; légende dessous ;
 * - `poster` (2:3) : l'affiche ; légende dessous.
 * Rien au centre de l'image, et aucune action SUR la carte : OK fait l'action
 * principale (la fiche d'une affiche, la lecture d'une vignette), l'appui
 * maintenu ouvre le grand panneau des actions. Au focus, la carte grandit et
 * garde ses marqueurs — la note, l'épingle Ma liste · j'aime · vu, la
 * progression.
 *
 * Sous la légende, au focus (`CardFocusFooter`) : la phrase de focus d'une
 * carte qui en a une (`card.focusNote`, la raison d'une recommandation), puis
 * — toute carte qui s'ouvre par l'appui maintenu (`onLongPress`) —
 * « Maintenir OK : plus d'options » : rien d'autre ne l'apprendrait. DANS
 * l'image, en bas à droite, quand le focus a tenu : la qualité du titre
 * (`CardQualityBadges` — « 4K · VISION · ATMOS »), lue au besoin à ce moment-là.
 *
 * Un titre ABSENT de la bibliothèque (`card.absent`) garde la même carte : son
 * affiche grisée et son badge (`AbsentArtwork`) remplacent image et marqueurs.
 *
 * L'ossature est celle de toute carte (`CardShell`) : la légende dessous,
 * puis la cible qui couvre image ET légende et ne porte que l'image — rien
 * ne la recouvre, et seule l'image suit le pouce (la parallaxe d'Apple TV).
 * `onFocusChange` dit le focus de la carte (`useCardFocused`).
 *
 * `previewable` (une carte de RANGÉE, jamais d'une grille) : quand son focus
 * tient, la carte peut devenir la grande carte de l'aperçu de sa
 * bande-annonce (`CardPreviewTile`) ; `onPreviewExpand` prévient la rangée,
 * qui lui réserve sa place et la montre entière, `onPreviewCollapse` quand
 * elle se replie. Fixé pour la vie de la carte : l'arbre ne change pas.
 *
 * `previewDriver` (une affiche de GRILLE) : sa grande carte est placée par sa
 * ligne (`gridPreviewLine`) — la cellule ne grandit pas, la grande carte en
 * déborde sur trois colonnes, et la cellule glisse quand c'est une voisine qui
 * grandit. Fixé pour la vie de la carte, lui aussi.
 */

export interface MediaCardProps {
  card: CardModel;
  variant: "landscape" | "poster";
  /** Largeur ; la hauteur suit le format. Absente : celle de la taille des
   *  cartes réglée (`useCardMetrics`). */
  width?: number;
  /** Sa place dans une rangée : elle recule quand une voisine a le focus. */
  place?: RowPlace;
  /** Recule — hors d'une rangée à valeur partagée (`place` l'emporte). */
  dimmed?: boolean;
  focusKey?: string;
  origin?: "top" | "center";
  /** Cacher la légende (grilles denses, rangées d'épisodes qui portent la leur). */
  hideCaption?: boolean;
  /** La lueur du focus : la lumière de l'œuvre (`art`, défaut), ou un blanc
   *  doux et bas pour une carte qui doit rester grise (`neutral`). */
  glowTone?: "art" | "neutral";
  onPress?: () => void;
  onLongPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
  /** La carte peut devenir la grande carte de l'aperçu (une rangée). */
  previewable?: boolean;
  /** Elle va grandir : la largeur de la grande carte, et ce que la carte gagne en hauteur (image et pied). */
  onPreviewExpand?: (tileWidth: number, grow: number) => void;
  /** Elle se replie. */
  onPreviewCollapse?: () => void;
  /** Sa grande carte et son glissement, menés par sa ligne de grille. */
  previewDriver?: CardGrowthDriver;
}

/** Ce que le pied de l'image descend quand elle grandit (et se soulève de 4) :
 *  la légende descend d'autant, l'image ne la recouvre jamais. */
function captionShift(height: number, origin: "top" | "center" = "top"): number {
  const growth = height * (CARD_FOCUS_SCALE - 1);
  return origin === "center" ? growth / 2 : Math.max(0, growth - 4);
}

/** La légende suit l'image qui grandit — sur le MÊME ressort que le cadre (`progress`). Placée par
 *  sa grille, la grande carte peut s'étendre à gauche : la légende (et « Maintenir OK ») glisse
 *  avec elle, de `slideBy` au bout de sa croissance (`slideProgress`). Sous la grande carte d'une
 *  rangée (`growProgress`), qui finit au bas de la place de l'image, la légende remonte de ce que
 *  l'agrandissement du focus l'avait fait descendre : elle reste à son écart de la vidéo. */
function Caption({ progress: p, shift, slideBy = 0, slideProgress, growProgress, children }: {
  progress: SharedValue<number>;
  shift: number;
  slideBy?: number;
  slideProgress?: SharedValue<number>;
  growProgress?: SharedValue<number>;
  children: ReactNode;
}) {
  const follow = useAnimatedStyle(() => ({
    transform: [
      { translateX: slideProgress ? slideBy * slideProgress.value : 0 },
      { translateY: shift * p.value * (growProgress ? 1 - growProgress.value : 1) },
    ],
  }));
  return <Animated.View style={[styles.caption, follow]}>{children}</Animated.View>;
}

/** Le logo d'une vignette, sur son dégradé — au-dessus de la note quand elle
 *  en a une (`cardLogoBottom`) : rien ne le recouvre. */
function LogoLayer({ uri, width, height, bottom }: { uri: string; width: number; height: number; bottom: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <SoftGradient width={width} height={height} colors={[scrim(0), scrim(0.55)]} locations={[0.35, 1]} />
      <Image source={{ uri }} style={[styles.logo, { bottom }]} resizeMode="contain" fadeDuration={0} />
    </View>
  );
}

export const MediaCard = memo(function MediaCard(props: MediaCardProps) {
  const cardFocus = useCardFocused(props.focusKey, props.onFocusChange);
  if (props.previewDriver) return <DrivenPreviewCard {...props} driver={props.previewDriver} cardFocus={cardFocus} />;
  return props.previewable ? <PreviewableCard {...props} cardFocus={cardFocus} /> : <CardBody {...props} cardFocus={cardFocus} growth={null} />;
});

/** Une affiche de grille : sa grande carte, placée par sa ligne. */
function DrivenPreviewCard(props: MediaCardProps & { driver: CardGrowthDriver; cardFocus: CardFocused }) {
  const growth = useDrivenCardGrowth(props.card, props.cardFocus.focused, props.driver);
  return <CardBody {...props} growth={growth} />;
}

/** Une carte de rangée : sa grande carte d'aperçu, selon son focus. */
function PreviewableCard(props: MediaCardProps & { cardFocus: CardFocused }) {
  const { card, variant, cardFocus, onPreviewExpand, onPreviewCollapse } = props;
  // La largeur réglée (`useCardMetrics`) : la grande carte part de la carte telle qu'elle est dessinée.
  const metrics = useCardMetrics();
  const width = props.width ?? metrics[variant].width;
  const size = useMemo(() => ({ width, height: cardHeight(variant, width) }), [variant, width]);
  // La place du pied pendant l'aperçu : la raison (s'il y en a une), « Maintenir OK », Lecture/Pause.
  const room = props.hideCaption ? 0 : cardFocusFooterHeight({ note: card.focusNote !== undefined, hold: props.onLongPress !== undefined, preview: true });
  const growth = useCardGrowth(card, cardFocus.focused, size, room, onPreviewExpand, onPreviewCollapse);
  return <CardBody {...props} growth={growth} />;
}

/** Le cadre de la carte — effacé sous sa grande carte quand elle en a une. Placée par sa grille,
 *  le cadre s'efface lui-même (`CardFrame` `under`) : pas de vue de plus dans chaque cellule. */
function FrameUnder({ growth, children }: { growth: CardGrowth | null; children: ReactNode }) {
  return growth && !growth.place ? <UnderPreviewTile growth={growth}>{children}</UnderPreviewTile> : <>{children}</>;
}

function cardHeight(variant: MediaCardProps["variant"], width: number): number {
  return Math.round(variant === "landscape" ? (width * 9) / 16 : width * 1.5);
}

function CardBody({
  card,
  variant,
  width: forcedWidth,
  place,
  dimmed,
  focusKey,
  origin,
  hideCaption = false,
  glowTone = card.absent ? "neutral" : "art",
  onPress,
  onLongPress,
  cardFocus,
  growth,
  previewDriver,
}: MediaCardProps & { cardFocus: CardFocused; growth: CardGrowth | null }) {
  const landscape = variant === "landscape";
  const frame = useCardMetrics()[variant];
  const width = forcedWidth ?? frame.width;
  const height = cardHeight(variant, width);
  const radius = frame.radius;
  const uri = landscape ? card.landscapeUri ?? card.posterUri : card.posterUri ?? card.landscapeUri;
  const { focused, onTargetFocusChange } = cardFocus;
  // Un seul ressort pour le cadre et la légende (`CardFrame focusProgress`).
  const progress = useFocusProgress(focused);
  const glow = useMemo(() => cardGlowOf(card.palette, glowTone), [card.palette, glowTone]);
  return (
    <CardShell
      focusKey={focusKey}
      width={width}
      frameHeight={height}
      front={focused}
      onPress={onPress}
      onLongPress={onLongPress}
      onTargetFocusChange={onTargetFocusChange}
      accessibilityLabel={card.title}
      // Placée par sa grille, la grande carte déborde : la cellule garde sa taille, et glisse.
      expansion={growth && !growth.place ? growth.expansion : undefined}
      glide={previewDriver?.glide}
      frame={
        <>
          <FrameUnder growth={growth}>
            <CardFrame
              width={width}
              height={height}
              radius={radius}
              focused={focused}
              place={place}
              dimmed={dimmed}
              origin={origin}
              glow={glow}
              focusProgress={progress}
              under={growth?.place ? growth.expansion.progress : undefined}
              focusLayer={
                card.quality && !card.absent ? (
                  <CardQualityBadges
                    quality={card.quality}
                    focused={focused}
                    width={width}
                    markers={card.markers}
                    progress={card.progress}
                    compact={!landscape}
                    logo={landscape && card.logoUri !== undefined}
                  />
                ) : undefined
              }
            >
              {/* L'image est clée par son adresse : une carte RECYCLÉE (grille)
                  qui change de titre ne garde pas l'affiche précédente le temps
                  que la sienne arrive — une Image d'iOS la garderait. */}
              {card.absent ? (
                <AbsentArtwork key={uri} absent={card.absent} uri={uri} title={card.title} year={card.subtitle} width={width} height={height} focused={focused} />
              ) : (
                <>
                  {uri ? (
                    <Image key={uri} source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
                  ) : (
                    <View style={styles.missing}>
                      <Text style={styles.missingTitle} numberOfLines={3}>{card.title}</Text>
                    </View>
                  )}
                  {landscape && card.logoUri ? (
                    <LogoLayer uri={card.logoUri} width={width} height={height} bottom={cardLogoBottom(card.markers, card.progress)} />
                  ) : null}
                  {card.badge ? <CardBadge label={card.badge} /> : null}
                  <CardMarkerLayer markers={card.markers} progress={card.progress} compact={!landscape} />
                </>
              )}
            </CardFrame>
          </FrameUnder>
          {growth ? <CardPreviewTile card={card} width={width} height={height} growth={growth} /> : null}
        </>
      }
    >
      {hideCaption ? null : (
        <Caption
          progress={progress}
          shift={captionShift(height, origin)}
          slideBy={growth?.place?.to.left}
          slideProgress={growth?.place ? growth.expansion.progress : undefined}
          growProgress={growth && !growth.place ? growth.expansion.progress : undefined}
        >
          <Text style={[styles.title, focused && styles.titleFocused]} numberOfLines={1}>{card.title}</Text>
          {card.subtitle ? <Text style={styles.subtitle} numberOfLines={card.subtitleLines ?? 1}>{card.subtitle}</Text> : null}
          <CardFocusFooter
            note={focused ? card.focusNote : undefined}
            hold={focused && onLongPress !== undefined}
            preview={focused ? growth?.remote ?? null : null}
            width={Math.round(width * 1.6)}
          />
        </Caption>
      )}
    </CardShell>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, padding: 22, justifyContent: "flex-end", backgroundColor: colors.surface3 },
  missingTitle: { ...fonts.bold, fontSize: 26, lineHeight: 30, color: colors.textSecondary },
  logo: { position: "absolute", left: LOGO_BOX.left, right: LOGO_BOX.right, height: LOGO_BOX.height },
  caption: { marginTop: 14, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  titleFocused: { color: colors.text },
  subtitle: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
