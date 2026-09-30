import { memo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Chip } from "../../controls/Chip";
import { FocusGroup } from "../../focus/FocusGroup";
import type { SeasonTabModel } from "./playerTypes";

/**
 * Les onglets de saisons : une pastille par saison — retenue quand elle est
 * ouverte, le triangle de lecture sur celle de l'épisode en cours, la coche
 * sur une saison vue, le nombre d'épisodes à droite. Jusqu'à 15 saisons et
 * plus : la bande défile, ouverte sur la saison active.
 * Clé : `episodes:season:<n>` (rang dans la bande) ; groupe `episodes:seasons`
 * — la bande, où l'intégration peut faire entrer le focus par la saison
 * AFFICHÉE plutôt que par la pastille la plus proche.
 */

/** Largeur moyenne d'une pastille (« Saison 12 · 56 ») : l'ouverture de la
 *  bande sur la saison active n'a pas besoin d'être au point près. */
const CHIP_STEP = 214;

export const SeasonTabs = memo(function SeasonTabs({
  seasons,
  activeId,
  onSelect,
}: {
  seasons: SeasonTabModel[];
  activeId: string;
  onSelect?: (id: string) => void;
}) {
  const active = Math.max(0, seasons.findIndex((season) => season.id === activeId));
  return (
    <FocusGroup focusKey="episodes:seasons">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.content}
        contentOffset={{ x: Math.max(0, (active - 1) * CHIP_STEP), y: 0 }}
      >
        {seasons.map((season, index) => (
          <Chip
            key={season.id}
            size="md"
            label={season.label}
            detail={season.count !== undefined ? String(season.count) : undefined}
            icon={season.current ? "play" : undefined}
            trailingIcon={season.watched ? "check" : undefined}
            selected={season.id === activeId}
            focusKey={`episodes:season:${index}`}
            onPress={onSelect ? () => onSelect(season.id) : undefined}
          />
        ))}
      </ScrollView>
    </FocusGroup>
  );
});

const styles = StyleSheet.create({
  // Rognée au panneau : les saisons suivantes ne débordent pas du verre.
  strip: { flexGrow: 0 },
  content: { gap: 14, paddingHorizontal: 32, paddingVertical: 10 },
});
