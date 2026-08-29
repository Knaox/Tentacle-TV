import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { LeaderboardAvatar } from "./LeaderboardAvatar";
import { formatDuration, barRatio, rankValue } from "./leaderboardFormat";
import { useSeriesFavorites } from "./leaderboardApi";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  hasAvatar: boolean;
  moviesPlayed: number;
  episodesPlayed: number;
  totalPlayed: number;
  watchSeconds: number | null;
  lastPlayedDate: string | null;
}

interface Props {
  entree: LeaderboardEntry;
  rang: number;
  maximum: number;
  moi: boolean;
  reducedMotion: boolean;
}

/**
 * Trois places, trois médailles. Au-delà, le rang en chiffres suffit : une
 * quatrième couleur ne voudrait plus rien dire.
 */
const MEDALS: Record<number, string> = {
  1: "linear-gradient(135deg, #FFD84D, #E0A200)",
  2: "linear-gradient(135deg, #E2E8F0, #94A3B8)",
  3: "linear-gradient(135deg, #E8A87C, #B4703C)",
};

/** Constante de MODULE : un littéral en JSX rejouerait l'animation à chaque rendu. */
const ROW = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const } },
};

export function LeaderboardRow({ entree, rang, maximum, moi, reducedMotion }: Props) {
  const { t } = useTranslation("easterEggs");
  const [expanded, setExpanded] = useState(false);
  const duration = formatDuration(entree.watchSeconds);
  const ratio = barRatio(rankValue(entree), maximum);
  const medal = MEDALS[rang];

  // Rien n'est demandé au serveur tant que la ligne n'est pas ouverte.
  const { data: detail, isLoading: detailLoad } = useSeriesFavorites(entree.userId, expanded);

  return (
    <motion.li
      variants={reducedMotion ? undefined : ROW}
      className={`rounded-xl px-2.5 py-2 ${
        moi ? "bg-[rgba(var(--brand-rgb),0.12)] ring-1 ring-[rgba(var(--brand-rgb),0.35)]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 text-left"
      >
      <span
        aria-hidden
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        style={
          medal
            ? { background: medal, color: "#231604" }
            : { color: "var(--text-quaternary)" }
        }
      >
        {rang}
      </span>

      <LeaderboardAvatar userId={entree.userId} name={entree.name} hasAvatar={entree.hasAvatar} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold text-content-primary">
            {entree.name}
            {moi && <span className="ml-1.5 text-xs font-normal text-content-tertiary">{t("vous")}</span>}
          </span>
          {/* La valeur est TOUJOURS écrite : la barre n'est qu'un rappel visuel,
              elle ne porte aucune information à elle seule. Chasse tabulaire
              pour que les chiffres s'alignent d'une ligne à l'autre. */}
          <span
            className="flex-shrink-0 text-sm font-bold text-content-primary"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {duration ?? t("rienVu")}
          </span>
        </div>

        {/* Piste + remplissage : les coins arrondis sont portés par la PISTE,
            qui découpe. Le remplissage est un rectangle nu mis à l'échelle en
            `scaleX` — jamais en `width`, qui relayoute à chaque image. */}
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill-soft">
          <motion.div
            className="h-full origin-left rounded-none bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]"
            initial={reducedMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: ratio }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: reducedMotion ? 0 : 0.1 }}
            style={{ width: "100%" }}
          />
        </div>

          <p className="mt-1 text-[11px] text-content-tertiary" style={{ fontVariantNumeric: "tabular-nums" }}>
            {t("detailVus", { films: entree.moviesPlayed, episodes: entree.episodesPlayed })}
          </p>
        </div>

        <svg
          aria-hidden
          className={`h-4 w-4 flex-shrink-0 text-content-quaternary transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-lg bg-fill-faint px-3 py-2">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-quaternary">
                {t("seriesFavorites")}
              </p>
              {detailLoad && <p className="text-xs text-content-tertiary">{t("chargement")}</p>}
              {detail && detail.series.length === 0 && (
                <p className="text-xs text-content-tertiary">{t("aucuneSerie")}</p>
              )}
              {detail?.series.map((s) => (
                <div key={s.seriesId} className="flex items-baseline justify-between gap-3 py-0.5">
                  <span className="truncate text-xs text-content-secondary">{s.name}</span>
                  <span
                    className="flex-shrink-0 text-xs text-content-tertiary"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {t("episodesCount", { count: s.episodesPlayed })}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
