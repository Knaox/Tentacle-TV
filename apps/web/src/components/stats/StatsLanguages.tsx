import { memo } from "react";
import { Headphones } from "lucide-react";
import { LISTENING_VERSIONS, listeningHeadline, listeningState, type ViewingStats } from "@tentacle-tv/shared";
import { HBarList, type HBarItem } from "./HBarList";
import { StatsSection } from "./StatsSection";
import { useStatsFormat, type StatsFormat } from "./useStatsFormat";

/** Sous 1 %, « autres » ou « inconnue » ne valent pas une ligne. */
const REMAINDER_MIN = 0.01;

function remainder(f: StatsFormat, key: string, label: string, share: number, base: number): HBarItem | null {
  if (share < REMAINDER_MIN) return null;
  return { key, label, value: share, display: f.percent(share), secondary: f.duration(share * base), muted: true };
}

/**
 * « Origine des titres » — le pays où ils ont été produits (fiche TMDB),
 * pondéré par le temps passé : d'où VIENT ce qu'on regarde, pas ce qu'on
 * entend. Les autres pays et l'origine inconnue ferment la liste, en neutre :
 * le tout fait 100 %, rien n'est deviné.
 */
export const OriginsCard = memo(function OriginsCard({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const { countries, otherShare, unknownShare } = stats.origins;
  if (countries.length === 0) return null;
  const total = stats.totals.seconds;
  const items: HBarItem[] = countries.map((c) => ({
    key: c.key, label: c.label, value: c.share, display: f.percent(c.share), secondary: f.duration(c.seconds),
  }));
  for (const extra of [
    remainder(f, "other", f.t("originsOther"), otherShare, total),
    remainder(f, "unknown", f.t("originsUnknown"), unknownShare, total),
  ]) if (extra) items.push(extra);
  return (
    <StatsSection title={f.t("originsTitle")} hint={f.t("originsHint")}>
      <HBarList ariaLabel={f.t("originsTitle")} max={1} items={items} />
    </StatsSection>
  );
});

/**
 * « VF ou VO ? » — d'après la piste audio LUE, que Tentacle relève depuis
 * `since` : la version qui domine, la part de chacune (VF = doublage dans la
 * langue de l'interface), puis les langues entendues. Chaque base est dite
 * sous la carte. Tant que l'échantillon est trop mince, un mot dit depuis
 * quand la mesure court — jamais un pourcentage tiré de trois séances.
 */
export const ListeningCard = memo(function ListeningCard({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const l = stats.listening;
  const state = listeningState(l);
  if (state === "hidden") return null;
  const since = l.since ? f.isoDay(l.since, true) : "";

  if (state === "pending") {
    return (
      <StatsSection title={f.t("listeningTitle")} hint={f.t("listeningHint")}>
        <p className="flex items-start gap-3 rounded-xl bg-fill-faint px-4 py-3.5 text-sm leading-relaxed text-content-secondary">
          <Headphones size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--brand-light)]" />
          {f.t("listeningPending", { date: since })}
        </p>
      </StatsSection>
    );
  }

  const headline = listeningHeadline(l);
  const versions = l.versions;
  const languages: HBarItem[] = l.languages.map((lang) => ({
    key: lang.key, label: lang.label, value: lang.share, display: f.percent(lang.share), secondary: f.duration(lang.seconds),
  }));
  const other = remainder(f, "other", f.t("listeningOther"), l.otherShare, l.knownSeconds);
  if (other) languages.push(other);

  return (
    <StatsSection title={f.t("listeningTitle")} hint={f.t("listeningHint")}>
      {headline && versions && (
        <>
          <p className="text-[15px] font-semibold text-content-primary">{f.t(`listeningHeadline_${headline.version}`)}</p>
          <p className="mb-4 text-[13px] text-content-secondary">{f.t("listeningHeadlineShare", { share: f.percent(headline.share) })}</p>
          <HBarList
            ariaLabel={f.t("listeningTitle")}
            max={1}
            items={LISTENING_VERSIONS.filter((v) => versions[v] > 0).map((v) => ({
              key: v, label: f.t(`version_${v}`), value: versions[v], display: f.percent(versions[v]), secondary: f.duration(versions[v] * l.versionSeconds),
            }))}
          />
        </>
      )}
      {languages.length > 0 && (
        <div className={headline ? "mt-6 border-t border-line-subtle pt-5" : ""}>
          <h3 className="mb-3 text-[13px] font-semibold text-content-secondary">{f.t("listeningLanguages")}</h3>
          <HBarList ariaLabel={f.t("listeningLanguages")} max={1} items={languages} />
        </div>
      )}
      <p className="mt-5 text-xs leading-relaxed text-content-tertiary">
        {f.t("listeningBase", { date: since, duration: f.duration(l.knownSeconds) })}
        {versions && l.knownSeconds - l.versionSeconds >= 60 && ` ${f.t("listeningVersionBase", { duration: f.duration(l.versionSeconds) })}`}
      </p>
    </StatsSection>
  );
});
