import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon as ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CaretRightIcon as ChevronRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { FilmSlateIcon as Clapperboard } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { HandHeartIcon as HeartHandshake } from "@phosphor-icons/react/dist/csr/HandHeart";
import { SparkleIcon as Sparkles } from "@phosphor-icons/react/dist/csr/Sparkle";
import { TelevisionIcon as Tv } from "@phosphor-icons/react/dist/csr/Television";
import { XIcon as X } from "@phosphor-icons/react/dist/csr/X";
import type { Icon as IconType } from "@phosphor-icons/react";
import { WtApiError, fetchAffinityKinds, startAffinity, type AffinityKinds, applyAffinityPush, closeAffinity, showAffinityView } from "@tentacle-tv/api-client";
import { AFFINITY_KINDS, KIND_LABEL_KEY } from "@tentacle-tv/shared";
import type { WtAffinityKind, WtAffinityStateDto } from "@tentacle-tv/shared";

/**
 * Le choix du type : films, séries ou animés, chacun avec le nombre de titres
 * que TOUT le groupe peut lire. Un type sans titre commun ne se choisit pas.
 * Choisir lance l'affinité chez tout le groupe ; le type d'une séance
 * refermée la reprend, votes compris (« Reprendre »). Une séance en cours :
 * c'est un changement de type, et il se dit (la pile repart pour tout le
 * monde). Les refus se disent ici, pas en toast : il passerait sous le voile.
 */

const ICONS: Record<WtAffinityKind, IconType> = { movie: Clapperboard, series: Tv, anime: Sparkles };

export function AffinityKindsView({ state, titleId }: { state: WtAffinityStateDto | null; titleId: string }) {
  const { t } = useTranslation("watchTogether");
  const [kinds, setKinds] = useState<AffinityKinds | null>(null);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<WtAffinityKind | null>(null);
  const switching = state !== null;
  const counts = kinds?.counts;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetchAffinityKinds()
      .then((k) => !cancelled && setKinds(k))
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailed(true);
        if (err instanceof WtApiError && err.status === 404 && !err.code) setProblem(t("affinityServerTooOld"));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, t]);

  const pick = async (kind: WtAffinityKind) => {
    setBusy(kind);
    setProblem(null);
    try {
      applyAffinityPush(await startAffinity(kind));
      showAffinityView("deck");
    } catch (err) {
      const code = err instanceof WtApiError ? err.code : undefined;
      if (code === "empty_catalog") setKinds((k) => (k ? { ...k, counts: { ...k.counts, [kind]: 0 } } : k));
      else setProblem(t(code === "need_two_members" ? "affinityNeedTwo" : "errorGeneric"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <header className="flex items-start gap-3 px-6 pb-4 pt-6">
        {switching ? (
          <button
            type="button"
            onClick={() => showAffinityView("deck")}
            aria-label={t("back")}
            className="icon-btn -ml-2"
          >
            <ArrowLeft aria-hidden className="h-5 w-5" />
          </button>
        ) : (
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent"
          >
            <HeartHandshake className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-heading-3 text-content-primary">
            {switching ? t("affinityChooseKind") : t("affinityFind")}
          </h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-content-tertiary">
            {switching ? t("affinitySwitchWarning") : t("affinityFindHint")}
          </p>
        </div>
        {/* En cours de séance, on revient à la pile (Échap quitte) ; sans
            séance, fermer ne quitte rien. */}
        {!switching && (
          <button
            type="button"
            onClick={closeAffinity}
            aria-label={t("close")}
            className="icon-btn -mr-2 -mt-1"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {failed ? (
          <div className="rounded-tile bg-surface-2 px-4 py-4 text-center" role="alert">
            <p className="text-sm text-content-secondary">{t("affinityKindsError")}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-3 btn btn-sm btn-soft"
            >
              {t("affinityRetry")}
            </button>
          </div>
        ) : (
          <ul className="space-y-2" aria-busy={kinds === null}>
            {AFFINITY_KINDS.map((kind) => {
              const Icon = ICONS[kind];
              const count = counts?.[kind];
              const current = state?.kind === kind;
              const resumable = !current && !!kinds?.resume.includes(kind);
              const detail = count === undefined ? t("affinityCounting") : count === 0 ? t("affinityKindNone") : t("affinityKindCount", { count });
              return (
                <li key={kind}>
                  <button
                    type="button"
                    onClick={() => void pick(kind)}
                    disabled={!count || busy !== null}
                    className="group flex w-full items-center gap-4 rounded-tile bg-surface-2 px-4 py-3.5 text-left outline-none transition-colors duration-hover hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-content-primary">{t(KIND_LABEL_KEY[kind])}</span>
                      <span className="block text-xs tabular-nums text-content-tertiary">{busy === kind ? t("affinityPreparing") : detail}</span>
                    </span>
                    {(current || resumable) && (
                      <span className="chip">
                        {t(current ? "affinityCurrent" : "affinityResume")}
                      </span>
                    )}
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-content-quaternary" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {problem && (
          <p role="alert" className="mt-3 text-xs leading-relaxed text-status-error-fg">
            {problem}
          </p>
        )}
        <p className="mt-4 text-xs leading-relaxed text-content-tertiary">{t("affinityScope")}</p>
        <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t("affinityPrivate")}</p>
      </div>
    </>
  );
}
