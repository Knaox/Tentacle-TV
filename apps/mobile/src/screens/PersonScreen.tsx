import { useCallback } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { ExternalSearchItem, SearchProvider } from "@tentacle-tv/shared";
import { backOrHome } from "@/utils/backOrHome";
import { GradientOverlay, Button } from "@/components/ui";
import { DetailTopBar } from "@/components/detail/DetailTopBar";
import { ExternalSections } from "@/components/search/SearchExternal";
import { useSearchNavigation } from "@/components/search/useSearchNavigation";
import { PersonHeader } from "@/components/person/PersonHeader";
import { PersonBio, PersonFilmography } from "@/components/person/PersonBody";
import { usePersonScreen } from "@/components/person/usePersonScreen";
import { DETAIL_MAX_WIDTH, FONT_FAMILY, spacing, useResponsive, useTheme } from "@/theme";

interface Props {
  personId: string;
  /** Le crédit par lequel on arrive (`Director`…) — cf. `usePersonScreen`. */
  role: string | null;
}

/**
 * L'écran d'une personne — ouvert d'une touche sur le casting ou l'équipe
 * d'une fiche. Le décor est emprunté à son titre le mieux noté (FIXE : pas de
 * parallaxe, une seule image), le portrait à cheval dessus ; puis la vie, la
 * biographie, la filmographie en bibliothèque et ce que les extensions
 * connaissent d'autre.
 */
export function PersonScreen({ personId, role }: Props) {
  const { t } = useTranslation(["media", "common"]);
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { height, width } = useWindowDimensions();
  const { isTablet } = useResponsive();
  const nav = useSearchNavigation({ modal: false });
  const page = usePersonScreen(personId, role);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const backdropH = Math.min(isTablet ? 460 : 340, Math.round(height * 0.42));
  const portraitW = Math.min(isTablet ? 160 : 120, Math.round(width * 0.3));
  const backdropUri = page.backdrop
    ? client.getImageUrl(page.backdrop.Id, "Backdrop", { width: 1200, quality: 80 })
    : null;
  const name = page.details.data?.Name ?? "";
  const openItem = useCallback((id: string) => router.push(`/media/${id}`), [router]);
  const openExternal = useCallback(
    (provider: SearchProvider, item: ExternalSearchItem) => nav.openExternalItem(provider, item),
    [nav],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface.s0 }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxl + 40 + insets.bottom }}
      >
        <View style={{ width: "100%", height: backdropH, overflow: "hidden" }}>
          {backdropUri && (
            <Image source={{ uri: backdropUri }} style={[StyleSheet.absoluteFill, { opacity: 0.7 }]} contentFit="cover" transition={300} />
          )}
          <GradientOverlay direction="top" height={120 + insets.top} intensity="soft" />
          <GradientOverlay direction="bottom" height={backdropH * 0.85} intensity="detail" />
        </View>

        <View style={{ width: "100%", maxWidth: DETAIL_MAX_WIDTH, alignSelf: "center" }}>
          {page.details.data ? (
            <PersonHeader
              id={personId}
              name={name}
              imageTag={page.details.data.ImageTags?.Primary ?? null}
              life={page.life}
              roles={page.facets.roles.map((r) => r.role).filter((r) => r !== "Other")}
              countLabel={page.countLabel}
              portraitW={portraitW}
              like={page.like}
            />
          ) : page.details.isError ? (
            <View style={{ paddingHorizontal: spacing.screenPadding, gap: spacing.md, alignItems: "flex-start" }}>
              <Text style={{ fontSize: 15, fontFamily: FONT_FAMILY.medium, color: theme.colors.text.secondary }}>
                {t("media:personLoadError")}
              </Text>
              <Button title={t("common:retry")} onPress={() => void page.details.refetch()} variant="secondary" />
            </View>
          ) : null}

          <PersonBio overview={page.details.data?.Overview} />

          <PersonFilmography
            pending={page.filmography.isPending}
            entries={page.entries}
            shown={page.shown}
            facets={page.facets}
            kind={page.kind}
            role={page.role}
            onKind={page.setKind}
            onRole={page.setRole}
            onOpen={openItem}
          />

          {page.outside.length > 0 && (
            <ExternalSections results={page.outside} onOpen={openExternal} onSeeAll={nav.openExternal} layout="grid" />
          )}
        </View>
      </Animated.ScrollView>

      <DetailTopBar title={name} scrollY={scrollY} revealAt={backdropH * 0.62} onBack={() => backOrHome(router)} />
    </View>
  );
}
