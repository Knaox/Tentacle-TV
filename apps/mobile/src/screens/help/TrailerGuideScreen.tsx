import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useJellyfinDashboardUrl, useTrailerReadiness } from "@tentacle-tv/api-client";
import { TRAILER_GUIDE_STEPS, type TrailerGuideLinkContext, type TrailerGuidePart } from "@tentacle-tv/shared";
import { SubtleBackground } from "@/components/ui";
import { FLOATING_BACK_SIZE, FloatingBackButton } from "@/components/navigation/FloatingBackButton";
import { GuideEveryoneSection } from "@/components/help/GuideEveryoneSection";
import { GuideHeader } from "@/components/help/GuideHeader";
import { GuideHiddenNote } from "@/components/help/GuideHiddenNote";
import { GuideStatusNotice } from "@/components/help/GuideStatusNotice";
import { GuideStepCard } from "@/components/help/GuideStepCard";
import { makeGuideStyles } from "@/components/help/guideStyles";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { backOrHome } from "@/utils/backOrHome";
import { spacing, useContentPadding, useThemedStyles } from "@/theme";

/**
 * Le guide « Bandes-annonces » (`/help/trailers`) — la page du web, à la
 * forme des écrans empilés de l'app : « Pour tous », puis « Pour
 * l'administrateur ». `?section=admin` ouvre sur la partie administrateur.
 *
 * Même contenu que partout (`help/trailerGuide.ts`, espace `trailerHelp`).
 * Les liens ne s'ouvrent qu'à un administrateur : le tableau de bord de
 * Jellyfin à l'adresse que donnent les réglages recommandés, l'administration
 * de Tentacle dans le navigateur (le téléphone n'en a pas).
 */
export function TrailerGuideScreen() {
  const { t } = useTranslation("trailerHelp");
  const g = useThemedStyles(makeGuideStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const padding = useContentPadding(720);
  const top = Math.max(insets.top, 24);
  const isAdmin = useIsAdmin();
  const { serverUrl } = useServerUrl();
  const dashboard = useJellyfinDashboardUrl({ enabled: isAdmin });
  const ctx = useMemo<TrailerGuideLinkContext>(
    () => ({ isAdmin, jellyfinUrl: dashboard.data ?? null, adminOrigin: isAdmin && serverUrl ? serverUrl : null }),
    [isAdmin, dashboard.data, serverUrl],
  );

  // Les ordonnées des deux parties, relevées à la mise en page : le sommaire
  // et `?section=admin` y font défiler.
  const scroll = useRef<ScrollView>(null);
  const [offsets, setOffsets] = useState<Partial<Record<TrailerGuidePart, number>>>({});
  const measure = (part: TrailerGuidePart) => (event: LayoutChangeEvent) => {
    const y = event.nativeEvent.layout.y;
    setOffsets((current) => (current[part] === y ? current : { ...current, [part]: y }));
  };
  const jump = useCallback(
    (part: TrailerGuidePart, animated = true) => {
      const y = offsets[part];
      // Le titre de la partie s'arrête sous le retour flottant, pas dessous.
      if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - top - FLOATING_BACK_SIZE - spacing.md), animated });
    },
    [offsets, top],
  );
  // `?section=admin` : le saut attend l'encadré « Sur ce serveur », qui
  // arrive avec le diagnostic et pousse la partie vers le bas — puis suit la
  // partie tant que la personne n'a pas fait défiler elle-même.
  const readiness = useTrailerReadiness();
  const settled = readiness.isFetched || readiness.isError;
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current || params.section !== "admin" || offsets.admin === undefined || !settled) return;
    jump("admin", false);
  }, [params.section, offsets.admin, settled, jump]);

  return (
    <SubtleBackground ambient>
      <View style={st.container}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ paddingTop: top, paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: padding }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => { touched.current = true; }}
        >
          <GuideHeader topInset={0} onJump={(part) => { touched.current = true; jump(part); }} />
          <GuideStatusNotice isAdmin={isAdmin} />
          <View style={st.part} onLayout={measure("everyone")}>
            <GuideEveryoneSection isAdmin={isAdmin} onSeeSteps={() => { touched.current = true; jump("admin"); }} />
          </View>
          <View style={st.part} onLayout={measure("admin")}>
            <Text style={g.partTitle} accessibilityRole="header">
              {t("partAdmin")}
            </Text>
            <Text style={g.paragraph}>{t("adminLead")}</Text>
            {TRAILER_GUIDE_STEPS.map((step, index) => (
              <GuideStepCard key={step.id} step={step} number={index + 1} ctx={ctx} />
            ))}
          </View>
          <GuideHiddenNote />
        </ScrollView>
        <FloatingBackButton top={top} onPress={() => backOrHome(router)} />
      </View>
    </SubtleBackground>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  part: { marginTop: spacing.xxl + spacing.md },
});
