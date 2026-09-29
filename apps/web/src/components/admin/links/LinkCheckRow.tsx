import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CircleAlert, CircleCheck, CircleHelp, Globe, PencilLine, Zap, type LucideIcon } from "lucide-react";
import type { LinkCheck, LinkCheckId, LinkCheckState } from "@tentacle-tv/shared";
import { StatusPill, type StatusTone } from "../kit";
import { LinkBenefits } from "../../serverLinks/LinkBenefits";
import { LinkEndpointLine } from "../../serverLinks/LinkEndpointLine";

/**
 * Une recommandation d'accès — lien public, lecture directe — sur le modèle
 * des réglages de Jellyfin (`SetupCheckRow`) : son état réel, pourquoi elle
 * compte, chaque adresse et ce que sa sonde a trouvé, puis le geste — le
 * champ de la page « Services », sur lequel la page s'ouvre directement.
 *
 * Le pourquoi s'affiche en entier tant qu'il reste quelque chose à faire ;
 * une fois fait, il se replie sous « Pourquoi ? ».
 */

const TONE: Record<LinkCheckState, StatusTone> = { done: "success", todo: "warning", attention: "warning", unknown: "neutral" };
const STATE_ICON: Record<LinkCheckState, LucideIcon> = { done: CircleCheck, todo: CircleAlert, attention: CircleAlert, unknown: CircleHelp };
const ICON_TONE: Record<LinkCheckState, string> = {
  done: "bg-status-success-bg text-status-success-fg",
  todo: "bg-status-warning-bg text-status-warning-fg",
  attention: "bg-status-warning-bg text-status-warning-fg",
  unknown: "bg-fill-soft text-content-tertiary",
};
const CHECK_ICON: Record<LinkCheckId, LucideIcon> = { publicUrl: Globe, directPlay: Zap };

/** Le champ à remplir : l'ancre de la section « Services », qui y met le focus. */
export const LINK_FIELD: Record<LinkCheckId, string> = {
  publicUrl: "/admin/services#publicurl",
  directPlay: "/admin/services#directstreaming",
};

export function LinkCheckRow({ check }: { check: LinkCheck }) {
  const { t } = useTranslation("serverLinks");
  const Icon = check.state === "done" ? CHECK_ICON[check.id] : STATE_ICON[check.state];
  const filled = check.endpoints.some((endpoint) => endpoint.url);
  // Les adresses d'une lecture directe coupée et vide ne disent rien de plus que la note.
  const endpoints = filled ? check.endpoints : check.endpoints.filter((endpoint) => endpoint.role === "tentacle");

  return (
    <li className="flex gap-3 px-5 py-4">
      <span aria-hidden="true" className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${ICON_TONE[check.state]}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-sm font-semibold text-content-primary">{t(`check_${check.id}`)}</h3>
          <StatusPill tone={TONE[check.state]} size="sm">{t(`state_${check.state}`)}</StatusPill>
          <span className="text-[11px] font-medium uppercase tracking-wider text-content-quaternary">{t("levelRecommended")}</span>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-content-tertiary">{t(`summary_${check.id}`)}</p>
        {check.state === "done" ? (
          <details className="group mt-1.5 max-w-3xl">
            <summary className="inline-flex min-h-[32px] cursor-pointer list-none items-center rounded-md text-xs font-medium text-content-secondary underline-offset-4 hover:text-content-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
              {t("whyTitle")}
            </summary>
            <div className="mt-1">
              <LinkBenefits id={check.id} />
            </div>
          </details>
        ) : (
          <div className="mt-2 max-w-3xl">
            <LinkBenefits id={check.id} />
          </div>
        )}
        {endpoints.length > 0 && (
          <div className="mt-3 grid max-w-3xl gap-2 md:grid-cols-2">
            {endpoints.map((endpoint) => <LinkEndpointLine key={endpoint.role} endpoint={endpoint} />)}
          </div>
        )}
        {check.notes.length > 0 && (
          <ul className="mt-2 max-w-3xl space-y-1">
            {check.notes.map((note) => (
              <li key={note} className="text-xs leading-relaxed text-content-tertiary">{t(`note_${note}`)}</li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Link
            to={LINK_FIELD[check.id]}
            className={
              check.state === "done"
                ? "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-content-secondary underline-offset-4 transition hover:text-content-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                : "inline-flex h-9 items-center gap-1.5 rounded-full border border-[color:rgba(var(--brand-rgb),0.4)] bg-[rgba(var(--brand-rgb),0.16)] px-3.5 text-[13px] font-medium text-content-primary transition hover:bg-[rgba(var(--brand-rgb),0.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            }
          >
            <PencilLine size={14} aria-hidden="true" className={check.state === "done" ? "" : "text-[var(--brand-light)]"} />
            {filled ? t("actionEdit") : t("actionSet")}
          </Link>
        </div>
      </div>
    </li>
  );
}
