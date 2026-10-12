import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useMetadataArrival } from "@tentacle-tv/api-client";
import { lacksMetadata, type MediaItem } from "@tentacle-tv/shared";

/**
 * Le message d'un titre que Jellyfin n'a pas (encore) trouvé, au téléviseur :
 * une PHRASE, sans bouton. Un téléviseur jumelé n'administre pas Jellyfin
 * (« Réanalyser maintenant » exige une session personnelle), et rien de
 * focalisable ne s'ajoute à la fiche. Même règle que partout
 * (`lacksMetadata`) ; la fiche se met à jour seule à l'arrivée des
 * métadonnées (`useMetadataArrival`, socket déjà ouvert par l'app).
 *
 * Substitué à `apps/web/src/components/detail/MetadataHint.tsx`.
 */
export const MetadataHint = memo(function MetadataHint({ item }: { item: MediaItem; tone?: "media" | "page" }) {
  const { t } = useTranslation("metadataHint");
  useMetadataArrival(item);
  if (!lacksMetadata(item)) return null;

  return (
    <p className="pointer-events-none mt-5 max-w-3xl text-base leading-snug text-on-media-secondary">
      {t("bodyTv")}
    </p>
  );
});
