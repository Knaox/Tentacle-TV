import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { WatchProviderEntry } from "@tentacle-tv/api-client";
import { PlatformLogo } from "../../reco/PlatformLogo";

/** Assez pour reconnaître un pays à ses plateformes, pas au point d'en faire une grille. */
const SHOWN = 10;

interface RegionPreviewProps {
  /** Les plateformes du pays, dans l'ordre d'affichage de TMDB. */
  providers: readonly WatchProviderEntry[];
  /** L'aperçu du pays précédent, gardé le temps que le suivant arrive. */
  stale: boolean;
}

/** Les premières plateformes d'un pays — celles que ses pastilles et ses filtres montreront. */
export const RegionPreview = memo(function RegionPreview({ providers, stale }: RegionPreviewProps) {
  const { t } = useTranslation("adminMetadata");
  const shown = providers.slice(0, SHOWN);
  const more = providers.length - shown.length;
  return (
    <div className={`transition-opacity duration-200 ${stale ? "opacity-50" : ""}`}>
      <p className="mb-2 text-xs font-medium text-content-tertiary">{t("regionPreview")}</p>
      <ul className="flex flex-wrap items-center gap-2">
        {shown.map((provider) => (
          <li key={provider.id} title={provider.name}>
            <PlatformLogo logoPath={provider.logoPath} label={provider.name} className="h-9 w-9" />
            <span className="sr-only">{provider.name}</span>
          </li>
        ))}
        {more > 0 && (
          <li className="px-1 text-xs text-content-tertiary">{t("regionPreviewMore", { count: more })}</li>
        )}
      </ul>
    </div>
  );
});
