import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { RecoOverview } from "@tentacle-tv/api-client";
import { getUserInfo } from "../userMenu/menuItems";

interface RecoStatusBannerProps {
  overview: RecoOverview;
  /** Au moins une rangée hors des trois globales est annoncée. */
  hasPersonalizedRows: boolean;
  /** Rouvre la grille de démarrage à froid (phase « hold » de la page). */
  onOpenColdStart: () => void;
}

const CTA_CLASS =
  "shrink-0 rounded-full border border-cta-primary-border bg-cta-primary-bg px-4 py-1.5 " +
  "text-sm font-medium text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover";

/** Phrase discrète, dans la veine des bandeaux historiques de la page. */
function Hint({ children }: { children: ReactNode }) {
  return <p className="row-gutter mb-6 text-sm text-content-tertiary">{children}</p>;
}

/** Bloc actionnable : bord verre discret, sans backdrop-filter (règle GPU) et
 *  sans role="alert" — informationnel, pas une panne. */
function Actionable({ text, cta }: { text: string; cta: ReactNode }) {
  return (
    <div className="row-gutter mb-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line-subtle bg-fill-faint px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-content-secondary">{text}</p>
        {cta}
      </div>
    </div>
  );
}

/**
 * UN bandeau d'état à la fois — le premier vrai gagne. L'ordre porte le sens :
 * la perso coupée PAR L'UTILISATEUR prime (le nag de configuration serait du
 * bruit), puis la clé TMDB absente (admin actionnable, utilisateur informé),
 * puis les états de calcul du profil et du pool.
 */
export function RecoStatusBanner({ overview, hasPersonalizedRows, onOpenColdStart }: RecoStatusBannerProps) {
  const { t } = useTranslation("reco");
  const cold = overview.state === "cold";

  if (overview.personalized === false) {
    return (
      <Actionable
        text={t("disabledBanner")}
        cta={
          <Link to="/settings/personalization" className={CTA_CLASS}>
            {t("disabledBannerCta")}
          </Link>
        }
      />
    );
  }
  if (overview.tmdbConfigured === false) {
    if (getUserInfo().isAdmin) {
      return (
        <Actionable
          text={t("tmdbAdminBanner")}
          cta={
            <Link to="/admin/metadata" className={CTA_CLASS}>
              {t("tmdbAdminBannerCta")}
            </Link>
          }
        />
      );
    }
    return <Hint>{t("genericOnlyHint")}</Hint>;
  }
  if (cold && (overview.generating || overview.refining)) return <Hint>{t("generatingHint")}</Hint>;
  if (cold) {
    return (
      <Actionable
        text={t("coldBannerHint")}
        cta={
          <button type="button" onClick={onOpenColdStart} className={CTA_CLASS}>
            {t("coldBannerCta")}
          </button>
        }
      />
    );
  }
  if (overview.exploring) return <Hint>{t("exploringHint")}</Hint>;
  if (overview.state === "warming") return <Hint>{t("warmingHint")}</Hint>;
  if (overview.generating && !hasPersonalizedRows) return <Hint>{t("generatingHint")}</Hint>;
  if (overview.refining && overview.rows.length > 0) return <Hint>{t("preliminaryHint")}</Hint>;
  return null;
}
