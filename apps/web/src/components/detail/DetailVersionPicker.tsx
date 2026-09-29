import { useCallback, useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { mediaVersions, type MediaItem } from "@tentacle-tv/shared";

const ACTIVE_STYLE = {
  background: "linear-gradient(120deg, var(--brand) 0%, var(--brand-accent) 100%)",
};

/**
 * Les VERSIONS d'un film — ou, depuis Jellyfin 12, d'un épisode — à lire :
 * « 1080p », « 720p », « Director's Cut ». Une pilule par version, la choisie
 * au dégradé de marque (la grammaire des saisons : « choisir parmi »), sous la
 * rangée d'actions ; « Lecture » lit celle-là.
 *
 * Une seule version : rien. Un groupe radio (WAI-ARIA) : Tab entre sur la
 * version choisie, les flèches passent d'une version à l'autre en la choisissant.
 */
export function DetailVersionPicker({ item, value, onChange }: {
  item: MediaItem;
  /** La version choisie (`MediaSourceId`), `null` : celle de Jellyfin, la première. */
  value: string | null;
  onChange: (versionId: string) => void;
}) {
  const { t } = useTranslation("media");
  const group = useRef<HTMLDivElement>(null);
  const versions = mediaVersions(item.MediaSources);
  const selected = value ?? versions[0]?.id;

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step === 0 || versions.length === 0) return;
    e.preventDefault();
    const index = versions.findIndex((v) => v.id === selected);
    const next = versions[(index + step + versions.length) % versions.length];
    onChange(next.id);
    group.current?.querySelector<HTMLButtonElement>(`[data-version="${CSS.escape(next.id)}"]`)?.focus();
  }, [versions, selected, onChange]);

  if (versions.length === 0) return null;
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={t("detailVersionLabel")}
      onKeyDown={onKeyDown}
      className="mt-4 flex flex-wrap items-center gap-2"
    >
      <span className="mr-1 text-sm font-medium text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)]">
        {t("detailVersion")}
      </span>
      {versions.map((v) => {
        const active = v.id === selected;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-version={v.id}
            onClick={() => onChange(v.id)}
            className={`h-11 rounded-full px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${
              active
                ? "text-cta-brand-fg ring-1 ring-white/20"
                : "border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.38)] text-on-media-secondary hover:text-on-media-primary"
            }`}
            style={active ? ACTIVE_STYLE : undefined}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
