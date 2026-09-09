/**
 * Le bandeau de l'accueil local : ce qu'on était en train de regarder, en
 * grand, avec son logo et un bouton qui reprend là où l'on s'est arrêté.
 *
 * L'accueil hors ligne s'ouvrait sur une grille d'affiches — la même que
 * n'importe quelle bibliothèque, sans hiérarchie ni point d'entrée. Le
 * téléphone a son bandeau cinématique depuis la 1.7 ; le bureau le rejoint.
 *
 * Tout est LOCAL : l'image de fond, le logo et la progression viennent du
 * disque, ce bandeau ne coûte pas un octet de réseau. Il ne s'affiche que si
 * l'image de fond existe — un dégradé nu ne vaut pas la place qu'il prend.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { pickHeroEntries, watchStateOf, type DownloadListEntry } from "@tentacle-tv/offline-core";
import { localResourceUrl, useDownloadsRootReady } from "./localFiles";

export function OfflineHomeHero({ entries }: { entries: readonly DownloadListEntry[] }) {
  const { t } = useTranslation("downloads");
  const navigate = useNavigate();
  useDownloadsRootReady();
  const [failed, setFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const entry = pickHeroEntries(entries, 1)[0];
  if (entry === undefined) return null;
  const backdrop = localResourceUrl(`meta/${entry.itemId}/backdrop.jpg`);
  if (!backdrop || failed) return null;
  const logo = logoFailed ? null : localResourceUrl(`meta/${entry.itemId}/logo.png`);
  const percent = watchStateOf(entry).percent ?? 0;
  const title = entry.kind === "episode" ? entry.seriesName ?? entry.title : entry.title;
  const subtitle =
    entry.kind === "episode" && entry.parentIndexNumber !== null && entry.indexNumber !== null
      ? `S${String(entry.parentIndexNumber).padStart(2, "0")}E${String(entry.indexNumber).padStart(2, "0")} · ${entry.title ?? ""}`
      : null;

  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl border border-line-subtle">
      <img
        src={backdrop}
        alt=""
        decoding="async"
        className="h-56 w-full object-cover md:h-72"
        onError={() => setFailed(true)}
      />
      {/* Deux voiles fixes, pas d'animation : un dégradé repeint à chaque image
          coûterait une passe de peinture plein cadre. */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--surface-1) 4%, transparent 62%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to right, var(--surface-1) 2%, transparent 55%)" }} />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 md:p-7">
        {/* L'étiquette dit CE QUE le bandeau montre — reprendre, ou le dernier
            arrivé. Elle répétait le titre de la page, qui est juste au-dessus. */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-tertiary">
          {percent > 0 ? t("heroResume") : t("heroLatest")}
        </p>
        {logo ? (
          // Le logo tient dans min(70 % du bandeau, 22rem) — dit avec une largeur
          // et un plafond, jamais `min()` : le socle Chrome 53 du téléviseur
          // ignorerait la déclaration entière (passe compat webOS).
          <span className="block w-[70%] max-w-[22rem]">
            <img
              src={logo}
              alt={title ?? ""}
              decoding="async"
              className="max-h-16 w-auto max-w-full object-contain object-left"
              onError={() => setLogoFailed(true)}
            />
          </span>
        ) : (
          <h2 className="max-w-xl truncate text-2xl font-bold text-content-primary md:text-3xl">{title}</h2>
        )}
        {subtitle && <p className="max-w-xl truncate text-sm text-content-secondary">{subtitle}</p>}
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/watch/${entry.itemId}`)}
            className="flex items-center gap-2 rounded-full bg-cta-primary-bg px-5 py-2.5 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            {percent > 0 ? t("heroResume") : t("episodePlay")}
          </button>
          {percent > 0 && (
            <div className="h-1 w-40 overflow-hidden rounded-full bg-fill-soft">
              <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
