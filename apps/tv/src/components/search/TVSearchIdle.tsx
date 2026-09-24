import { memo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { SearchFacetHit } from "@tentacle-tv/shared";
import { Focusable } from "../focus/Focusable";
import { TVSearchChip } from "./TVSearchChip";
import { Colors, Spacing, Typography } from "../../theme/colors";
import { SHOWS_VERTICAL_SCROLL_INDICATOR } from "../../theme/focus";

interface TVSearchIdleProps {
  /** `idle` : rien de tapé. `empty` : la saisie ne trouve rien. */
  mode: "idle" | "empty";
  query: string;
  recents: string[];
  genres: SearchFacetHit[];
  onPickQuery: (query: string) => void;
  onOpenGenre: (name: string) => void;
}

/**
 * Ce que montre la recherche quand elle n'a pas de résultats à montrer — et
 * qui n'est jamais une impasse : les recherches récentes (un appui les
 * relance), les genres de la bibliothèque à parcourir, et une phrase qui dit
 * ce que le moteur comprend (un acteur, un genre, une faute de frappe).
 */
export const TVSearchIdle = memo(function TVSearchIdle({
  mode, query, recents, genres, onPickQuery, onOpenGenre,
}: TVSearchIdleProps) {
  const { t } = useTranslation("search");
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: Spacing.rowGutter, paddingTop: 24 }}
      showsVerticalScrollIndicator={SHOWS_VERTICAL_SCROLL_INDICATOR}
    >
      <Text style={{ color: Colors.textPrimary, ...Typography.detailTitle, marginBottom: 10 }}>
        {mode === "idle" ? t("emptyTitle") : t("noResults", { query })}
      </Text>
      <Text style={{ color: Colors.textSecondary, ...Typography.body, maxWidth: 720, marginBottom: 40 }}>
        {mode === "idle" ? t("emptyHint") : t("noResultsHint")}
      </Text>

      {recents.length > 0 && (
        <ChipGroup title={t("recent")}>
          {recents.map((recent) => (
            <Focusable key={recent} variant="button" focusRadius={999} onPress={() => onPickQuery(recent)} accessibilityLabel={recent}>
              <TVSearchChip label={recent} />
            </Focusable>
          ))}
        </ChipGroup>
      )}

      {genres.length > 0 && (
        <ChipGroup title={t("browseGenres")}>
          {genres.map((genre) => (
            <Focusable
              key={genre.name}
              variant="button"
              focusRadius={999}
              onPress={() => onOpenGenre(genre.name)}
              accessibilityLabel={genre.name}
            >
              <TVSearchChip label={genre.name} detail={String(genre.count)} capitalize />
            </Focusable>
          ))}
        </ChipGroup>
      )}
    </ScrollView>
  );
});

function ChipGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 40 }}>
      <Text style={{ color: Colors.textSecondary, ...Typography.sectionTitle, marginBottom: 16 }}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{children}</View>
    </View>
  );
}
