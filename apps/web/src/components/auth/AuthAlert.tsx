import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

type Tone = "error" | "success" | "info";

const TONES: Record<Tone, { icon: typeof Info; className: string }> = {
  error: { icon: AlertCircle, className: "border-status-error bg-status-error-bg text-status-error-fg" },
  success: { icon: CheckCircle2, className: "border-status-success bg-status-success-bg text-status-success-fg" },
  info: { icon: Info, className: "border-line-subtle bg-fill-subtle text-content-secondary" },
};

/**
 * Un message d'état dans la carte : icône + texte, jamais la couleur seule.
 * L'erreur s'annonce (`role="alert"`), le reste poliment (`role="status"`).
 */
export function AuthAlert({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  const { icon: Icon, className: toneClass } = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed ${toneClass} ${className ?? ""}`}
    >
      <Icon aria-hidden size={17} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
