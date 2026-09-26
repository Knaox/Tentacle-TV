import type { ReactNode } from "react";
import { CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";

/**
 * L'encadré d'information d'une page d'administration : « le redémarrage est
 * nécessaire », « renseignez d'abord l'URL publique », « la variable
 * d'environnement prime ». Un fond teinté, une icône, pas de bordure : les
 * statuts n'ont pas de jeton de bordure hors du rouge, et une bordure écrite
 * `[var(--status-warning)]/30` ne produisait aucun CSS.
 *
 * `role` est laissé à l'appelant : `alert` pour une erreur qui APPARAÎT en
 * réponse à une action, rien pour un encadré présent dès l'ouverture.
 */

export type NoticeTone = "info" | "warning" | "error" | "success";

const TONE: Record<NoticeTone, { box: string; accent: string; Icon: typeof Info }> = {
  info: { box: "bg-status-info-bg", accent: "text-status-info-fg", Icon: Info },
  warning: { box: "bg-status-warning-bg", accent: "text-status-warning-fg", Icon: TriangleAlert },
  error: { box: "bg-status-error-bg", accent: "text-status-error-fg", Icon: OctagonAlert },
  success: { box: "bg-status-success-bg", accent: "text-status-success-fg", Icon: CircleCheck },
};

export interface AdminNoticeProps {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Un lien ou un bouton sous le texte. */
  action?: ReactNode;
  role?: "alert" | "status";
  className?: string;
}

export function AdminNotice({ tone = "info", title, children, action, role, className }: AdminNoticeProps) {
  const { box, accent, Icon } = TONE[tone];
  return (
    <div role={role} className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${box} ${className ?? ""}`}>
      <Icon aria-hidden="true" size={16} className={`mt-0.5 flex-shrink-0 ${accent}`} />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title ? <p className={`font-semibold ${accent}`}>{title}</p> : null}
        {children ? <div className={`${title ? "mt-0.5 " : ""}text-content-secondary`}>{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
