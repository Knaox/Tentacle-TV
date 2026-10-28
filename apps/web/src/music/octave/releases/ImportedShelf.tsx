/**
 * Octave — « Vos imports » : les sorties que le compte a importées (lien Bandcamp, fichiers), en tête des
 * albums de la Bibliothèque, rendues comme tout album (même carte, pastille « Importé »). Sans le point
 * `releases`, ou sans aucun import : rien.
 */

import { useTranslation } from "react-i18next";
import { useImportedReleases } from "@tentacle-tv/api-client";
import { AlbumCard, Shelf } from "../components/Cards";
import { CardRow } from "../components/CardRow";
import { useOctaveProvider } from "../mode/useOctaveProvider";

export function ImportedShelf() {
  const { t } = useTranslation("musicReleases");
  const imported = useImportedReleases(useOctaveProvider());
  const albums = imported.data?.albums ?? [];
  if (albums.length === 0) return null;
  return (
    <Shelf title={t("importedRow")}>
      <CardRow items={albums} render={(album) => <AlbumCard key={album.key} album={album} />} />
    </Shelf>
  );
}
