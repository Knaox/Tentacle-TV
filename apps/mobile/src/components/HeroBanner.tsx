import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList, StyleSheet, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { GradientOverlay } from "@/components/ui";
import { useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { useDeferredMount } from "@/hooks/useDeferredMount";
import { HeroAmbilight } from "./HeroAmbilight";
import { useHeroMetrics } from "./heroMetrics";
import { HERO_ROTATE_MS, HeroBackdropStack } from "./hero/HeroBackdropStack";
import type { HeroSlide } from "./hero/heroSlides";

interface HeroBannerProps {
  /** Les diapositives — voir `hero/heroSlides` ; mémoïsées par l'appelant. */
  slides: HeroSlide[];
}

/**
 * Hero Billboard cinématique — désormais une CARTE, comme sur le bureau :
 * gouttières latérales, rayon 20, liseré de marque (--hero-frame-ring).
 * Swipe pagingEnabled + Ken Burns synchronisé sur l'auto-rotation. Le bandeau
 * ne sait pas ce qu'il montre : chaque diapositive rend son propre contenu.
 */
export const HeroBanner = memo(function HeroBanner({ slides }: HeroBannerProps) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { bannerH, slideW, margin, radius } = useHeroMetrics();
  // Le flou SVG du halo est cher à rastériser : monté une fois l'écran
  // interactif, son fondu de 1,4 s absorbe le décalage.
  const haloReady = useDeferredMount();
  const listRef = useRef<FlatList<HeroSlide>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(index);
  useEffect(() => { indexRef.current = index; }, [index]);
  // Une diapositive retirée sous le doigt (note posée, « ne plus me
  // proposer ») ne laisse pas l'index pointer dans le vide.
  useEffect(() => {
    if (slides.length && index > slides.length - 1) setIndex(slides.length - 1);
  }, [slides.length, index]);
  const safeIndex = Math.min(index, Math.max(0, slides.length - 1));
  const userScrollingRef = useRef(false);

  // Un AUTRE jeu de diapositives (filtre changé, reprise renouvelée) repart de
  // la première : sinon la liste retombe à zéro pendant que l'index reste où
  // il était — image d'une diapositive, texte d'une autre.
  const signature = slides.map((s) => s.id).join("|");
  const signatureRef = useRef(signature);
  useEffect(() => {
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    setIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [signature]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      if (userScrollingRef.current) return;
      setIndex((p) => {
        const next = (p + 1) % slides.length;
        listRef.current?.scrollToOffset({ offset: next * slideW, animated: true });
        return next;
      });
    }, HERO_ROTATE_MS);
  }, [slides.length, slideW]);

  // Resync scroll on focus via indexRef — reading `index` directly would re-run
  // this effect on every auto-advance, killing the FlatList's animated scroll.
  useFocusEffect(useCallback(() => {
    const raf = requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: indexRef.current * slideW, animated: false }));
    startTimer();
    return () => { cancelAnimationFrame(raf); if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer, slideW]));

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / slideW);
    setIndex(newIndex);
    userScrollingRef.current = false;
    startTimer();
  };

  if (!slides.length) return <View style={{ height: bannerH }} />;

  const haloUri = slides[safeIndex]?.haloUri ?? null;

  return (
    <View style={{ paddingHorizontal: margin }}>
      {/* L'AMBILIGHT du desktop, par le pipeline de la TV : l'affiche active
          floutée au filtre SVG derrière la carte — le débordement gaussien EST
          l'extinction, aucun fondu par-dessus. Frère PRÉCÉDENT de la carte :
          peint dessous. */}
      {haloReady && (
        <HeroAmbilight uri={haloUri} inset={margin} cardW={slideW} cardH={bannerH} />
      )}
      <View
        style={{
          width: slideW,
          height: bannerH,
          borderRadius: radius,
          borderWidth: 1,
          // Le liseré du cadre desktop : rgba(brand, 0.22).
          borderColor: withAlpha(theme.colors.brand.violet, 0.22, theme.colors.border.strong),
          overflow: "hidden",
          backgroundColor: theme.colors.surface.s0,
        }}
      >
        <HeroBackdropStack slides={slides} activeIndex={safeIndex} />
        {/* Les voiles du bureau (scrims.css) : la « bande noire » venait de la
            FORME de la rampe (pente qui retombait à 70 %), pas de sa couleur —
            la rampe corrigée vit dans GradientOverlay. En SOMBRE le bas rejoint
            la page (surface.s0, défaut) ; en CLAIR il plafonne à 0,70 de noir
            PUR (le plafond est dans la rampe, jamais dans la couleur). */}
        <GradientOverlay direction="top" height={110} intensity="soft" color="rgba(0, 0, 0, 0.65)" />
        <GradientOverlay
          direction="bottom"
          height={bannerH * 0.62}
          intensity="strong"
          color={theme.isDark ? undefined : `rgb(${theme.colors.onMedia.scrimRgb})`}
        />
        <FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(slide) => slide.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          onScrollBeginDrag={() => { userScrollingRef.current = true; if (timerRef.current) clearInterval(timerRef.current); }}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({ length: slideW, offset: slideW * i, index: i })}
          style={StyleSheet.absoluteFillObject}
          renderItem={({ item, index: i }) => (
            <View style={[st.slide, { width: slideW, height: bannerH }]}>
              <View style={st.contentInner}>{item.render(i === safeIndex)}</View>
            </View>
          )}
        />

        {slides.length > 1 && (
          <View style={[st.dots, { bottom: bannerH * 0.04 }]} pointerEvents="none">
            {slides.map((slide, i) =>
              i === safeIndex ? (
                // La pastille active porte le dégradé de marque et son halo
                // rose — la même encre que la barre de progression du bureau.
                <LinearGradient
                  key={slide.id}
                  colors={[theme.colors.brand.violet, theme.colors.brand.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[st.dot, st.dotOn]}
                />
              ) : (
                <View key={slide.id} style={[st.dot, st.dotOff]} />
              ),
            )}
          </View>
        )}
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  slide: { justifyContent: "flex-end" as const, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 52 },
  contentInner: { width: "100%" as const, maxWidth: 640 },
  dots: { position: "absolute" as const, left: 0, right: 0, flexDirection: "row" as const, justifyContent: "center" as const, alignItems: "center" as const, gap: 5 },
  dot: { height: 3, borderRadius: 2 },
  dotOn: { width: 22, shadowColor: t.colors.brand.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 8 },
  dotOff: { width: 6, backgroundColor: t.colors.text.quaternary },
});
