/**
 * Octave mobile — la recherche SANS RÉSEAU : dans la musique gardée sur
 * l'appareil (`useKeptSearch`, la règle commune du hors ligne, axe m5), comme
 * le bureau hors ligne. Rien trouvé : on le dit, sans erreur.
 */

import { memo } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { CloudOff } from "lucide-react-native";
import { useKeptSearch } from "../../offline/useOfflineMusic";
import { SectionTitle } from "../ui/Shelf";
import { TrackList } from "../ui/TrackList";
import { EmptyState } from "../ui/ViewStates";

export const OfflineSearchResults = memo(function OfflineSearchResults({ query, gutter }: { query: string; gutter: number }) {
  const { t } = useTranslation("music");
  const { tracks } = useKeptSearch(query);
  if (tracks.length === 0) return <EmptyState icon={CloudOff} title={t("search.nothingFound", { query })} />;
  return (
    <View>
      <SectionTitle title={t("search.tracks")} />
      <TrackList tracks={tracks} contextId={`search:${query}`} gutter={gutter} />
    </View>
  );
});
