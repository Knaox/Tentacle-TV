import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { CircleAlert, CircleCheck, CircleDashed, type LucideIcon } from "lucide-react";
import type { LinkEndpointVerdict, LinkIssue, LinkTone } from "@tentacle-tv/shared";

/**
 * Une adresse et ce que sa sonde a trouvé : « Répond — Jellyfin 10.11.8 »,
 * ou chacun de ses soucis, dans les mots de l'espace `serverLinks`. Rendue à
 * l'identique par la vue d'ensemble et par l'assistant d'installation.
 *
 * Icône ET texte : l'état ne se lit jamais à la seule couleur.
 */

const ICON: Record<LinkTone, LucideIcon> = { success: CircleCheck, warning: CircleAlert, neutral: CircleDashed };
const COLOR: Record<LinkTone, string> = {
  success: "text-status-success-fg",
  warning: "text-status-warning-fg",
  neutral: "text-content-tertiary",
};

/** Le mot d'un souci — sa variante propre au rôle d'abord (`issue_unverified_jellyfinPrivate`). */
export function issueText(t: TFunction, issue: LinkIssue, endpoint: LinkEndpointVerdict): string {
  return t([`serverLinks:issue_${issue}_${endpoint.role}`, `serverLinks:issue_${issue}`], {
    status: endpoint.probe?.httpStatus ?? "",
  });
}

/** Ce que dit l'adresse quand elle n'a aucun souci. */
function statusText(t: TFunction, endpoint: LinkEndpointVerdict): string {
  if (!endpoint.url) return t("serverLinks:endpointMissing");
  if (endpoint.probe?.result !== "ok") return t("serverLinks:state_unknown");
  return endpoint.role === "tentacle"
    ? t("serverLinks:probe_ok_tentacle")
    : t("serverLinks:probe_ok_jellyfin", { version: endpoint.probe.version ?? "?" });
}

interface Props {
  endpoint: LinkEndpointVerdict;
  /** Le libellé du rôle au-dessus de l'adresse — l'assistant l'a déjà dans son champ. */
  showRole?: boolean;
  /** Les soucis déjà dits ailleurs (la phrase d'une recommandation) : la ligne ne les répète pas. */
  hideIssues?: readonly LinkIssue[];
}

export function LinkEndpointLine({ endpoint, showRole = true, hideIssues }: Props) {
  const { t } = useTranslation("serverLinks");
  const issues = hideIssues ? endpoint.issues.filter((issue) => !hideIssues.includes(issue)) : endpoint.issues;
  // Ses soucis déjà dits ailleurs, l'adresse ne garde que ce que la sonde a trouvé — et son ton.
  const tone: LinkTone = issues.length === endpoint.issues.length
    ? endpoint.tone
    : issues.length > 0 ? "warning" : endpoint.probe?.result === "ok" ? "success" : "neutral";
  const Icon = ICON[tone];
  const lines = issues.length > 0 ? issues.map((issue) => issueText(t, issue, endpoint)) : [statusText(t, endpoint)];

  return (
    <div className="min-w-0 rounded-lg bg-fill-subtle px-3 py-2">
      {showRole && (
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-medium text-content-secondary">{t(`role_${endpoint.role}`)}</span>
          {endpoint.url && <span className="min-w-0 break-all font-mono text-[11px] text-content-tertiary">{endpoint.url}</span>}
        </p>
      )}
      <ul className={showRole ? "mt-1 space-y-1" : "space-y-1"}>
        {lines.map((line) => (
          <li key={line} className={`flex items-start gap-1.5 text-xs leading-relaxed ${COLOR[tone]}`}>
            <Icon aria-hidden size={14} className="mt-px flex-shrink-0" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
