import { useMemo } from "react";
import type { TFunction } from "i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_STAGE } from "@tentacle-tv/theme";
import { backdropUriOf, paletteOfItem } from "../cards/cardArtwork";
import { FOCUS_ZOOM, imagePixels } from "../cards/imagePixels";
import { useCardModelFactory } from "../cards/cardModels";
import { legibleLogoOf, metaOf } from "../hero/heroModel";
import type { SearchModelSources } from "./searchModels";

/** Un portrait de la rangée « Personnes », à l'échelle de l'interface
 *  (`imagePixels` : net sur une Apple TV 4K, à sa taille sur Android TV). */
const PORTRAIT_HEIGHT = imagePixels(TV_STAGE.card.person.size, FOCUS_ZOOM);

/**
 * Ce que le modèle de la recherche tire de l'app : les cartes et la lumière
 * du socle, la ligne d'identité et le logo du héros (un logo noir cède au
 * titre), les adresses d'images du client Jellyfin. Un résultat du moteur est
 * un sous-ensemble de `MediaItem` : il se lit tel quel.
 */
export function useSearchSources(t: TFunction): SearchModelSources {
  const client = useJellyfinClient();
  const factory = useCardModelFactory();
  return useMemo<SearchModelSources>(
    () => ({
      t,
      full: (item) => item as unknown as MediaItem,
      card: (item, subtitle, variant) => factory(item, { variant, subtitle: () => subtitle }),
      palette: (item) => paletteOfItem(item),
      // Un seul genre : la ligne tient à côté du logo.
      meta: (item) => metaOf(item, t, { quality: false, genres: 1 }),
      backdrop: (item) => backdropUriOf(client, item),
      logo: (item) => legibleLogoOf(client, item),
      portrait: (person) =>
        person.imageTag ? client.getImageUrl(person.id, "Primary", { height: PORTRAIT_HEIGHT, tag: person.imageTag, quality: 85 }) : undefined,
    }),
    [t, client, factory],
  );
}
