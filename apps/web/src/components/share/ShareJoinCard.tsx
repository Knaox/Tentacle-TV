import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GlassCard } from "@tentacle-tv/ui";
import type { ShareListKind } from "@tentacle-tv/api-client";
import { TentacleSvg } from "../ui/TentacleSvg";

interface Props {
  ownerUsername: string;
  /** Ce qui est partagé : une liste, ou des statistiques. */
  kind: ShareListKind | "stats";
  authed: boolean;
  loginPath: string;
  registerPath: string;
}

const PRIMARY =
  "flex h-12 w-full items-center justify-center rounded-xl bg-cta-primary-bg px-5 text-sm font-bold text-cta-primary-fg shadow-[0_8px_24px_-8px_rgba(var(--brand-rgb),0.55)] transition-transform duration-150 hover:-translate-y-0.5 hover:bg-cta-primary-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 motion-reduce:hover:translate-y-0";
const SECONDARY =
  "flex h-11 w-full items-center justify-center rounded-xl border border-line-subtle bg-fill-subtle px-5 text-sm font-semibold text-content-primary transition-colors hover:border-line-strong hover:bg-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]";

/**
 * La carte « comment regarder ». Au visiteur sans compte, elle dit en trois
 * étapes comment rejoindre le serveur — invitation, compte, connexion — et
 * n'offre QUE des gestes possibles sans session : se connecter (retour ici
 * ensuite) ou s'inscrire avec une invitation. Au visiteur connecté, elle dit
 * ce qu'il peut faire de la liste.
 *
 * Verre posé sur le fond fixe de la page : rien ne bouge derrière, le flou ne
 * se recalcule jamais. L'ombre violette du bouton est posée, pas animée.
 */
export const ShareJoinCard = memo(function ShareJoinCard({ ownerUsername, kind, authed, loginPath, registerPath }: Props) {
  const { t } = useTranslation("share");

  if (authed) {
    return (
      <GlassCard className="p-5 sm:p-6">
        <p className="text-base font-bold text-content-primary">{t("memberTitle")}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-content-tertiary">
          {t(kind === "stats" ? "memberLeadStats" : kind === "likes" ? "memberLeadLikes" : "memberLeadWatchlist")}
        </p>
      </GlassCard>
    );
  }

  const steps = [t("joinStep1", { name: ownerUsername }), t("joinStep2"), t("joinStep3")];
  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ background: "radial-gradient(circle, rgba(var(--brand-rgb), 0.35) 0%, rgba(var(--brand-rgb), 0) 70%)" }}
        >
          <TentacleSvg size={40} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight text-content-primary">{t("joinTitle")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-content-tertiary">{t("joinLead")}</p>
        </div>
      </div>
      <ol aria-label={t("joinSteps")} className="mt-5 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-content-secondary">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums text-cta-brand-fg"
              style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
            >
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 space-y-2.5">
        <Link to={loginPath} className={PRIMARY}>{t("joinSignIn")}</Link>
        <Link to={registerPath} className={SECONDARY}>{t("joinRegister")}</Link>
      </div>
    </GlassCard>
  );
});
