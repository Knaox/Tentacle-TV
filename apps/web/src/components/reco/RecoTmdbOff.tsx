import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useActiveProfile } from "../../auth/profileSession";
import { ADMIN_TMDB_KEY_PATH } from "../../lib/adminTargets";
import { getUserInfo } from "../userMenu/menuItems";

const CTA_CLASS =
  "inline-flex shrink-0 items-center rounded-full border border-cta-primary-border bg-cta-primary-bg px-4 py-2 " +
  "text-sm font-medium text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]";

/**
 * Le réglage TMDB n'est offert qu'à un administrateur en session PERSONNELLE :
 * une session de profil (Famille, bureau) n'administre rien, même celle d'un
 * propriétaire (cf. `profileSessionRefusals`).
 */
export function useCanSetTmdbKey(): boolean {
  const profile = useActiveProfile();
  return getUserInfo().isAdmin && !profile;
}

/**
 * « Pour vous » sur un serveur SANS clé TMDB : les recommandations ne sont pas
 * activées. Un constat, pas une alerte — ni `role="alert"`, ni couleur
 * d'avertissement, ni reproche — dans le bloc discret des bandeaux de la page
 * (filet, fond faint, sans backdrop-filter : règle GPU). L'administrateur a
 * UN bouton, qui mène droit au champ de la clé (la cible du tableau de bord,
 * `ADMIN_TMDB_KEY_PATH`) ; les autres lisent qui peut les activer.
 */
export function RecoTmdbOff({ className = "" }: { className?: string }) {
  const { t } = useTranslation("reco");
  const canSet = useCanSetTmdbKey();
  return (
    <div className={className}>
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line-subtle bg-fill-faint px-4 py-3"
      >
        <Sparkles size={18} aria-hidden className="shrink-0 text-content-tertiary" />
        <div className="min-w-0 flex-1 basis-60 text-sm">
          <p className="text-content-primary">{t("tmdbOffText")}</p>
          <p className="mt-0.5 text-content-secondary">{t(canSet ? "tmdbOffAdminHint" : "tmdbOffMemberHint")}</p>
        </div>
        {canSet && (
          <Link to={ADMIN_TMDB_KEY_PATH} className={CTA_CLASS}>
            {t("tmdbOffCta")}
          </Link>
        )}
      </div>
    </div>
  );
}
