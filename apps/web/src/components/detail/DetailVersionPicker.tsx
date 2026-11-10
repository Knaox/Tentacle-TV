import { useTranslation } from "react-i18next";
import { mediaVersions, pickMediaSource, type MediaItem } from "@tentacle-tv/shared";


/**
 * Les VERSIONS d'un film — ou, depuis Jellyfin 12, d'un épisode — à lire :
 * « 1080p », « 720p », « Director's Cut ». Une pilule par version, la choisie
 * au dégradé de marque (la grammaire des saisons : « choisir parmi »), sous la
 * rangée d'actions ; « Lecture » lit celle-là. Une seule version : rien.
 *
 * Des boutons bascule (`aria-pressed`), tous atteignables, sans flèches
 * interceptées : le téléviseur webOS reprend ce composant, et son moteur de
 * focus ignore les `tabindex="-1"` d'un groupe radio à tabulation itinérante —
 * les versions non choisies y étaient inatteignables à la télécommande.
 */
export function DetailVersionPicker({ item, value, onChange }: {
  item: MediaItem;
  /** La version choisie (`MediaSourceId`), `null` : celle de Jellyfin, la première. */
  value: string | null;
  onChange: (versionId: string) => void;
}) {
  const { t } = useTranslation("media");
  const versions = mediaVersions(item.MediaSources);
  if (versions.length === 0) return null;
  // Sans choix (ou un choix périmé), celle que Jellyfin lirait : sa première.
  const selected = pickMediaSource(item.MediaSources, value)?.Id;
  return (
    <div role="group" aria-label={t("detailVersionLabel")} className="mt-4 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)]">
        {t("detailVersion")}
      </span>
      {versions.map((v) => {
        const active = v.id === selected;
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(v.id)}
            // La version retenue : la pastille pleine NEUTRE (ivoire sur image), jamais un dégradé.
            className={`btn btn-sm ${active ? "bg-on-media-primary text-[rgb(var(--scrim-media-rgb))]" : "btn-on-media"}`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
