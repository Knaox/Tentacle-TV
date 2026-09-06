import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { recoRowTitle } from "@tentacle-tv/api-client";
import type { RecoPage, RecoRowItem } from "@tentacle-tv/api-client";
import { FadeIn, SkeletonRow } from "@/components/ui";
import { RecoRow } from "@/components/reco/RecoRow";
import { spacing, typography, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  page: RecoPage;
  /** Un filtre de plateformes est posé : une page sans rangée le dit, une fois. */
  filtered: boolean;
  /** Données d'un AUTRE filtre encore affichées pendant l'échange : atténuées. */
  stale: boolean;
  canOpen: (item: RecoRowItem) => boolean;
  onItemPress: (item: RecoRowItem) => void;
  onItemLongPress: (item: RecoRowItem) => void;
}

/**
 * Les rangées de la page, rendues d'un coup depuis la page servie (clés
 * stables), avec la première raison sous chaque carte. Squelettes seulement
 * quand le moteur génère et n'a encore rien servi.
 */
export function RecoPageRows({ page, filtered, stale, canOpen, onItemPress, onItemLongPress }: Props) {
  const { t } = useTranslation("reco");
  const st = useThemedStyles(makeStyles);

  let body;
  if (page.generating && page.rows.length === 0) {
    body = [0, 1, 2].map((i) => (
      <View key={i} style={st.skeleton}><SkeletonRow /></View>
    ));
  } else if (filtered && page.rows.length === 0) {
    body = <Text style={st.empty}>{t("filterEmpty")}</Text>;
  } else {
    body = page.rows.map((row, i) => {
      const { key, params } = recoRowTitle(row);
      return (
        <FadeIn key={row.key} delay={Math.min(i, 4) * 60}>
          <RecoRow
            title={t(key, params)}
            items={row.items}
            showReasons
            canOpen={canOpen}
            onItemPress={onItemPress}
            onItemLongPress={onItemLongPress}
          />
        </FadeIn>
      );
    });
  }
  // Opacité seule (règle GPU) : l'échange de filtre atténue, ne blanchit pas.
  return <View style={{ opacity: stale ? 0.6 : 1 }}>{body}</View>;
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  skeleton: { marginTop: spacing.xxl },
  empty: { ...typography.body, color: t.colors.text.tertiary, paddingHorizontal: spacing.screenPadding, marginTop: spacing.xl },
});
