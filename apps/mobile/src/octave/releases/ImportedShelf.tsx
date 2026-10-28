/**
 * Octave mobile — « Vos imports » : les sorties importées par le compte, en tête de l'onglet Albums de la
 * Bibliothèque, rendues comme tout album (même carte, pastille « Importé »). Sans le point `releases`, ou sans
 * aucun import : rien. Le bord de la page est celui de l'en-tête qui la porte (l'étagère a sa propre marge).
 */

import { memo } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useImportedReleases } from "@tentacle-tv/api-client";
import { useOctavePagesProvider } from "../pages/env/pagesEnv";
import { AlbumCard } from "../pages/ui/Cards";
import { Shelf } from "../pages/ui/Shelf";

export const ImportedShelf = memo(function ImportedShelf({ inset }: { inset: number }) {
  const { t } = useTranslation("musicReleases");
  const albums = useImportedReleases(useOctavePagesProvider()).data?.albums ?? [];
  if (albums.length === 0) return null;
  return (
    <View style={{ marginHorizontal: -inset }}>
      <Shelf title={t("importedRow")} items={albums} keyOf={(a) => a.key} render={(album, width) => <AlbumCard album={album} width={width} />} />
    </View>
  );
});
