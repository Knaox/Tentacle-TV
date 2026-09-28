import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "../../../components/media/MediaDetailIcons";
import { FauxCard } from "../FauxCard";
import { Place } from "../Place";
import { sceneSpring, sceneTween } from "../sceneMotion";
import { FauxPortrait } from "./FauxPortrait";
import type { ScenePersonPage } from "./useScenePerson";

const POSTER = { w: 58, gap: 10, count: 8, x: 28, y: 262 } as const;

interface FauxPersonPageProps {
  page: ScenePersonPage;
  name: string;
  visible: boolean;
  /** La filmographie se révèle, carte après carte. */
  filmography: boolean;
}

/**
 * La page d'une personne (`Person` + `PersonHero`), ramenée au canevas : le
 * décor emprunté à son titre le mieux noté, voilé vers le fond de page ; le
 * portrait, les métiers, le nom, ce que Jellyfin sait de sa vie ; puis ses
 * titres DANS la bibliothèque.
 */
export function FauxPersonPage({ page, name, visible, filmography }: FauxPersonPageProps) {
  const { t } = useTranslation(["media", "common"]);
  return (
    <Place x={0} y={0} w={640} h={360} visible={visible} dy={visible ? 0 : 14} transition={sceneTween} className="z-10 overflow-hidden bg-surface-0">
      <div className="absolute inset-x-0 top-0 h-[190px] overflow-hidden">
        {page.backdropUrl && <img src={page.backdropUrl} alt="" draggable={false} className="h-full w-full object-cover opacity-60" />}
        {/* Voiles en calques plutôt qu'en `color-mix()` : le socle Chrome 53 du
            téléviseur ignorerait la déclaration entière. */}
        <div className="absolute inset-0 bg-surface-0 opacity-30" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, var(--surface-0) 0%, var(--surface-0) 10%, transparent 72%)" }} />
        <div className="absolute inset-0 opacity-70" style={{ background: "linear-gradient(90deg, var(--surface-0) 0%, transparent 60%)" }} />
      </div>
      <span className="absolute left-4 top-3 flex h-7 items-center gap-1.5 rounded-full border border-line-subtle bg-[var(--glass-tint)] px-3 text-[11px] text-content-secondary [&_svg]:h-3.5 [&_svg]:w-3.5">
        <ArrowLeftIcon />
        {t("common:back")}
      </span>
      <FauxPortrait name={name} url={page.person?.portraitUrl ?? null} className="absolute left-7 top-[70px] w-[88px] rounded-[var(--radius-md)] ring-1 ring-line-subtle" />
      <div className="absolute left-[134px] right-6 top-[112px]">
        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
          {t("media:personKicker")}
          {page.roles.length > 0 && <span className="text-brand-light"> · {page.roles.join(" · ")}</span>}
        </p>
        <p className="mt-1 truncate text-[26px] font-bold leading-tight tracking-tight text-content-primary">{name}</p>
        {page.countLabel && <p className="mt-0.5 text-[10px] text-content-tertiary">{page.countLabel}</p>}
        {page.facts.length > 0 && (
          <dl className="mt-2.5 flex gap-6">
            {page.facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-[8px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{fact.label}</dt>
                <dd className="truncate text-[10px] text-content-secondary">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <p className="absolute left-7 top-[236px] text-[13px] font-semibold tracking-tight text-content-primary">{t("media:personInLibraryTitle")}</p>
      {Array.from({ length: POSTER.count }, (_, i) => {
        const url = page.posters[i];
        // Rien de plus que ce que la filmographie compte : jamais une affiche d'un autre.
        if (page.posters.length > 0 && !url) return null;
        return (
          <FauxCard
            key={i}
            x={POSTER.x + i * (POSTER.w + POSTER.gap)}
            y={POSTER.y}
            w={POSTER.w}
            poster={url ? { id: url, title: "", year: null, rating: null, url, progress: null, backdropUrl: null } : null}
            tone={i}
            visible={filmography}
            dy={filmography ? 0 : 10}
            transition={{ ...sceneSpring, delay: filmography ? i * 0.06 : 0 }}
          />
        );
      })}
    </Place>
  );
}
