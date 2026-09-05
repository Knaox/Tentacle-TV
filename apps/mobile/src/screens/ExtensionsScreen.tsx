import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useActivePlugins } from "@/hooks/useActivePlugins";
import { useExtensionTab } from "@/hooks/useExtensionSections";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { useExpandChromeOnFocus } from "@/components/navigation/scrollChrome";
import { SectionStrip } from "@/components/extensions/SectionStrip";
import { ExtensionPane } from "@/components/extensions/ExtensionPane";
import { BrandSpinner } from "@/components/ui/BrandSpinner";
import { Button } from "@/components/ui/Button";
import { spacing, typography, useThemedStyles, type AppTheme } from "@/theme";

/**
 * L'onglet unique des extensions : sous l'en-tête, le bandeau des sections
 * (une par page d'extension, seulement s'il y en a plus d'une) ; dessous, un
 * volet par section, conservé une fois visité.
 *
 * L'adresse est la vérité : le lien profond `/extensions?section=<id>` et la
 * pilule écrivent tous deux le paramètre, il n'y a pas d'état parallèle à
 * réconcilier — le dernier lien gagne, un choix manuel n'empêche jamais le
 * lien suivant. Section absente ou disparue : la première.
 */
export function ExtensionsScreen() {
  const router = useRouter();
  const headerH = useHeaderHeight();
  const st = useThemedStyles(makeStyles);
  const { t: tc } = useTranslation("common");
  const { t: tn } = useTranslation("nav");
  const { isPending } = useActivePlugins();
  const { sections, multiPlugin } = useExtensionTab();
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  // Redéployé à l'arrivée ; ensuite, le volet actif pilote le chrome depuis
  // sa page (PluginWebView, message SCROLL_CHROME).
  useExpandChromeOnFocus();

  const wanted = typeof section === "string" ? section : undefined;
  const activeId = useMemo(
    () => sections.find((s) => s.id === wanted)?.id ?? sections[0]?.id,
    [sections, wanted],
  );

  // Volets déjà visités : montés une fois, conservés (état et défilement).
  const [visited, setVisited] = useState<string[]>([]);
  useEffect(() => {
    if (activeId) setVisited((v) => (v.includes(activeId) ? v : [...v, activeId]));
  }, [activeId]);

  const select = useCallback(
    (id: string) => { router.setParams({ section: id }); },
    [router],
  );
  const goHome = useCallback(() => { router.navigate("/"); }, [router]);

  if (sections.length === 0) {
    return (
      <View style={[st.center, { paddingTop: headerH }]}>
        {isPending ? (
          <BrandSpinner />
        ) : (
          <>
            <Text style={st.empty}>{tc("noPlugins")}</Text>
            <Button title={tn("home")} variant="secondary" onPress={goHome} />
          </>
        )}
      </View>
    );
  }

  return (
    <View style={[st.root, { paddingTop: headerH }]}>
      {sections.length > 1 && (
        <SectionStrip sections={sections} activeId={activeId} multiPlugin={multiPlugin} onSelect={select} />
      )}
      <View style={st.panes}>
        {sections
          .filter((s) => s.id === activeId || visited.includes(s.id))
          .map((s) => <ExtensionPane key={s.id} section={s} active={s.id === activeId} />)}
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface.s0 },
    panes: { flex: 1, overflow: "hidden" as const },
    center: {
      flex: 1,
      backgroundColor: t.colors.surface.s0,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: spacing.lg,
      padding: spacing.xxl,
    },
    empty: { ...typography.body, color: t.colors.text.tertiary, textAlign: "center" as const },
  });
