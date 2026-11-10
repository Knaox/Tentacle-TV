/**
 * Ce qu'un lot emporte, ligne par ligne : une case par SAISON quand on prend
 * toute la série, une case par ÉPISODE quand on prend une saison ou une
 * sélection. Tout est coché au départ ; ce qui est déjà sur la machine est
 * coché-gris et ne se décoche pas — il n'y a rien à reprendre.
 *
 * Portage de `ItemChecklist` / `SeasonChecklist` du téléphone. La clé de saison
 * vient du cœur (`seasonKey`) : Jellyfin donne parfois deux identifiants pour
 * une même saison, et grouper par identifiant en affichait deux lignes.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { seasonKey } from "@tentacle-tv/offline-core";
import type { MediaItem } from "@tentacle-tv/shared";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { formatBytes } from "./presets";

interface SeasonGroup {
  key: string;
  number: number | null;
  episodes: MediaItem[];
}

/** Les épisodes d'une série regroupés par saison, dans l'ordre des numéros. */
function groupBySeason(episodes: readonly MediaItem[]): SeasonGroup[] {
  const groups = new Map<string, SeasonGroup>();
  for (const episode of episodes) {
    const key = seasonKey(episode);
    const group = groups.get(key) ?? { key, number: episode.ParentIndexNumber ?? null, episodes: [] };
    group.episodes.push(episode);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));
}

function totalSize(items: readonly MediaItem[], sizeOf: (item: MediaItem) => number | null): number | null {
  let total = 0;
  let known = 0;
  for (const item of items) {
    const size = sizeOf(item);
    if (typeof size === "number" && size > 0) {
      total += size;
      known += 1;
    }
  }
  return known > 0 ? total : null;
}

/** La case du socle (`.ui-check`) ; déjà sur la machine : cochée, à l'encre — rien à reprendre. */
function CheckBox({ checked, muted }: { checked: boolean; muted: boolean }) {
  return (
    <span
      aria-hidden
      className="ui-check"
      data-checked={checked && !muted ? "true" : undefined}
      style={checked && muted ? { background: "var(--fill-strong)", boxShadow: "none", color: "var(--text-secondary)" } : undefined}
    >
      <CheckIcon size={13} weight="bold" />
    </span>
  );
}

function Row({
  checked,
  locked,
  label,
  detail,
  lockedHint,
  onToggle,
}: {
  checked: boolean;
  locked: boolean;
  label: string;
  detail: string;
  /** « Téléchargé » : pourquoi la ligne ne se décoche pas. */
  lockedHint: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={locked}
      disabled={locked}
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-field px-2.5 py-2 text-left transition-colors duration-hover ${
        locked ? "cursor-default" : "hover:bg-fill-soft"
      }`}
    >
      <CheckBox checked={checked} muted={locked} />
      <span className={`min-w-0 flex-1 truncate text-sm ${locked ? "text-content-tertiary" : "text-content-primary"}`}>{label}</span>
      {locked && <span className="chip chip-success flex-shrink-0">{lockedHint}</span>}
      {detail !== "" && <span className="num flex-shrink-0 text-xs text-content-tertiary">{detail}</span>}
    </button>
  );
}

/** Le bloc des cases : une tuile d'encre, comme sur la maquette. */
const LIST = "rounded-tile bg-surface-2 p-1";

interface SeasonProps {
  episodes: readonly MediaItem[];
  uncheckedSeasons: ReadonlySet<string>;
  onDevice: ReadonlySet<string>;
  sizeOf: (item: MediaItem) => number | null;
  onToggle: (key: string) => void;
}

export function SeasonChecklist({ episodes, uncheckedSeasons, onDevice, sizeOf, onToggle }: SeasonProps) {
  const { t } = useTranslation("downloads");
  const groups = useMemo(() => groupBySeason(episodes), [episodes]);
  return (
    <div className="flex flex-col gap-2.5">
      <span className="ui-eyebrow">{t("seasonsPickerLabel")}</span>
      <div className={`${LIST} max-h-56 overflow-y-auto`}>
        {groups.map((group) => {
          const left = group.episodes.filter((item) => !onDevice.has(item.Id));
          const locked = left.length === 0;
          const size = totalSize(left, sizeOf);
          const detail = [
            t("episodesCount", { count: left.length === 0 ? group.episodes.length : left.length }),
            size === null ? null : formatBytes(size),
          ]
            .filter((part): part is string => part !== null)
            .join(" · ");
          return (
            <Row
              key={group.key}
              checked={locked || !uncheckedSeasons.has(group.key)}
              locked={locked}
              label={group.number === null ? t("seasonUnknown") : t("seasonLabel", { num: group.number })}
              detail={detail}
              lockedHint={t("downloadedBadge")}
              onToggle={() => onToggle(group.key)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface EpisodeProps {
  items: readonly MediaItem[];
  selected: ReadonlySet<string>;
  onDevice: ReadonlySet<string>;
  sizeOf: (item: MediaItem) => number | null;
  onToggle: (itemId: string) => void;
}

/**
 * Devant le nom : le numéro seul (« 3. ») quand toute la liste est d'UNE saison — le titre de
 * la feuille la nomme déjà —, sinon le code complet (« S01E03 · »).
 */
function episodePrefix(item: MediaItem, oneSeason: boolean): string {
  if (item.IndexNumber == null) return "";
  if (oneSeason) return `${item.IndexNumber}. `;
  return `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} · `;
}

export function EpisodeChecklist({ items, selected, onDevice, sizeOf, onToggle }: EpisodeProps) {
  const { t } = useTranslation("downloads");
  const already = items.filter((item) => onDevice.has(item.Id)).length;
  const oneSeason = new Set(items.map((item) => item.ParentIndexNumber ?? 1)).size === 1;
  return (
    <div className="flex flex-col gap-2">
      <div className={`${LIST} max-h-56 overflow-y-auto`}>
        {items.map((item) => {
          const kept = onDevice.has(item.Id);
          const size = sizeOf(item);
          return (
            <Row
              key={item.Id}
              checked={kept || selected.has(item.Id)}
              locked={kept}
              label={`${episodePrefix(item, oneSeason)}${item.Name ?? ""}`}
              detail={size === null ? "" : formatBytes(size)}
              lockedHint={t("downloadedBadge")}
              onToggle={() => onToggle(item.Id)}
            />
          );
        })}
      </div>
      {already > 0 && <p className="text-xs text-content-tertiary">{t("alreadyOnDevice", { count: already })}</p>}
    </div>
  );
}
