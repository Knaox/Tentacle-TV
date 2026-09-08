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

function CheckBox({ checked, muted }: { checked: boolean; muted: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
        checked
          ? muted
            ? "border-line-subtle bg-fill-medium text-content-tertiary"
            : "border-line-focus bg-cta-primary-bg text-cta-primary-fg"
          : "border-line-strong bg-transparent text-transparent"
      }`}
      style={{ height: "1.125rem", width: "1.125rem" }}
    >
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

function Row({
  checked,
  locked,
  label,
  detail,
  onToggle,
}: {
  checked: boolean;
  locked: boolean;
  label: string;
  detail: string;
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
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 ${
        locked ? "opacity-55" : "hover:bg-fill-soft"
      }`}
    >
      <CheckBox checked={checked} muted={locked} />
      <span className="min-w-0 flex-1 truncate text-sm text-content-secondary">{label}</span>
      <span className="flex-shrink-0 text-xs tabular-nums text-content-quaternary">{detail}</span>
    </button>
  );
}

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
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-content-quaternary">
        {t("seasonsPickerLabel")}
      </p>
      <div className="space-y-0.5">
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

function episodeCode(item: MediaItem): string {
  if (item.IndexNumber == null) return "";
  return `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} · `;
}

export function EpisodeChecklist({ items, selected, onDevice, sizeOf, onToggle }: EpisodeProps) {
  const { t } = useTranslation("downloads");
  const already = items.filter((item) => onDevice.has(item.Id)).length;
  return (
    <div>
      {already > 0 && (
        <p className="mb-1.5 text-xs text-content-quaternary">{t("alreadyOnDevice", { count: already })}</p>
      )}
      <div className="max-h-56 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const kept = onDevice.has(item.Id);
          const size = sizeOf(item);
          return (
            <Row
              key={item.Id}
              checked={kept || selected.has(item.Id)}
              locked={kept}
              label={`${episodeCode(item)}${item.Name ?? ""}`}
              detail={size === null ? "" : formatBytes(size)}
              onToggle={() => onToggle(item.Id)}
            />
          );
        })}
      </div>
    </div>
  );
}
