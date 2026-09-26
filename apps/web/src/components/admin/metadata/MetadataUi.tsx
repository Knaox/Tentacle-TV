import { memo, type ReactNode } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { NoticeTone } from "./tmdbKey";

/*
 * Les briques visuelles de la page Métadonnées. Provisoires : le kit du socle
 * admin (AdminSection, StatusPill, AdminNotice) les remplacera dès qu'il sera
 * sur main — d'où leur isolement ici, un seul fichier à défaire.
 */

interface MetadataCardProps {
  id: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Pastille de statut, en haut à droite. */
  status?: ReactNode;
  children: ReactNode;
}

/** Une carte de réglage : pictogramme, titre, statut, puis le contenu. */
export function MetadataCard({ id, icon, title, subtitle, status, children }: MetadataCardProps) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-line-subtle bg-fill-faint p-5 sm:p-6">
      <header className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(var(--brand-rgb),0.15)] text-brand-light"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-lg font-semibold leading-tight text-content-primary">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-content-tertiary">{subtitle}</p>}
        </div>
        {status}
      </header>
      {children}
    </section>
  );
}

const PILL_TONES: Record<NoticeTone, string> = {
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  error: "bg-status-error-bg text-status-error-fg",
  neutral: "bg-fill-soft text-content-secondary",
};

/** Pastille d'état : une couleur ET un mot — jamais la couleur seule. */
export const StatusPill = memo(function StatusPill({ tone, children }: { tone: NoticeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold tracking-wide ${PILL_TONES[tone]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
});

const NOTICE_ICONS = { success: CircleCheck, warning: TriangleAlert, error: CircleX, neutral: Info } as const;

const NOTICE_TEXT: Record<NoticeTone, string> = {
  success: "text-status-success-fg",
  warning: "text-status-warning-fg",
  error: "text-status-error-fg",
  neutral: "text-content-tertiary",
};

/**
 * Un verdict en ligne, sous le geste qui l'a provoqué. L'annonce aux lecteurs
 * d'écran revient au conteneur `aria-live` du parent : une région vivante
 * insérée en même temps que son texte n'est pas toujours lue.
 */
export const InlineNotice = memo(function InlineNotice({ tone, children }: { tone: NoticeTone; children: ReactNode }) {
  const Icon = NOTICE_ICONS[tone];
  return (
    <p className={`flex items-start gap-2 text-sm leading-relaxed ${NOTICE_TEXT[tone]}`}>
      <Icon aria-hidden size={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
});
