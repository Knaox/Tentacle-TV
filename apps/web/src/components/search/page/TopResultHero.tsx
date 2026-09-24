/**
 * Le meilleur résultat, en tête de page : la bannière du titre (son fond, son
 * affiche, son identité, pourquoi il répond) avec « Lire » pour un film et
 * « Détails » — ou le portrait d'une personne et l'accès à sa filmographie.
 *
 * Posé sur une image : couleurs de texte « sur média », constantes entre les
 * thèmes (le voile sombre fait la lisibilité, pas le thème choisi).
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { itemMeta, matchReason, personMeta, type SearchTopHit } from "@tentacle-tv/shared";
import { HighlightedText } from "../HighlightedText";
import { PersonAvatar, PosterThumb } from "../SearchThumbs";

interface TopResultHeroProps {
  top: SearchTopHit;
  terms: readonly string[];
  onOpen: (path: string) => void;
}

export const TopResultHero = memo(function TopResultHero({ top, terms, onOpen }: TopResultHeroProps) {
  const { t, i18n } = useTranslation("search");
  const client = useJellyfinClient();

  if (top.kind === "person") {
    const person = top.hit;
    const path = `/search?person=${encodeURIComponent(person.id)}&name=${encodeURIComponent(person.name)}`;
    return (
      <section aria-label={t("topResult")} className="flex items-center gap-6 rounded-3xl border border-line-subtle bg-fill-faint p-6">
        <PersonAvatar person={person} size={112} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{t("topResult")}</p>
          <h2 className="mt-1 truncate text-3xl font-bold tracking-tight text-content-primary">
            <HighlightedText text={person.name} terms={terms} />
          </h2>
          <p className="mt-1.5 text-sm text-content-tertiary">{personMeta(t, person)}</p>
          <button type="button" onClick={() => onOpen(path)} className="mt-4 rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 py-2 text-sm font-bold text-cta-primary-fg transition-transform hover:scale-[1.03] active:scale-95">
            {t("filmography")}
          </button>
        </div>
      </section>
    );
  }

  const { item, match } = top.hit;
  const backdropTag = item.BackdropImageTags?.[0];
  const backdrop = backdropTag ? client.getImageUrl(item.Id, "Backdrop", { width: 1280, quality: 80, tag: backdropTag }) : null;
  const reason = matchReason(t, match);
  const progress = item.UserData?.PlayedPercentage ?? 0;
  return (
    <section aria-label={t("topResult")} className="relative isolate overflow-hidden rounded-3xl border border-line-subtle bg-surface-1">
      {backdrop !== null && (
        <img src={backdrop} alt="" loading="eager" decoding="async" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60" />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
      <div className="flex items-end gap-6 p-6 md:p-8">
        <PosterThumb item={item} height={360} className="hidden h-[180px] w-[120px] rounded-xl shadow-[var(--elev-2)] sm:block" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--on-media-secondary)]">{t("topResult")}</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-[var(--on-media-primary)] md:text-4xl">
            <HighlightedText text={item.Name} terms={terms} />
          </h2>
          <p className="mt-2 text-sm text-[var(--on-media-secondary)]">{itemMeta(t, item, i18n.language)}</p>
          {reason && <p className="mt-1 text-sm font-medium text-[var(--brand-light)]">{reason}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            {item.Type === "Movie" && (
              <button type="button" onClick={() => onOpen(`/watch/${item.Id}`)} className="inline-flex items-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 py-2.5 text-sm font-bold text-cta-primary-fg transition-transform hover:scale-[1.03] active:scale-95">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
                {progress > 0 && !item.UserData?.Played ? t("resume") : t("play")}
              </button>
            )}
            <button type="button" onClick={() => onOpen(`/media/${item.Id}`)} className="rounded-full bg-[var(--cta-secondary-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--cta-secondary-fg)] transition-colors hover:bg-[var(--cta-secondary-bg-hover)]">
              {t("details")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
});
