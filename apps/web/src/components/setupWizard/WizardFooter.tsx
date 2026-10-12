import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { cls } from "../../pages/adminUtils";

/** Un geste du pied de l'écran : l'action principale, ou une action secondaire (« Passer », « Plus tard »). */
export interface WizardAction {
  label: string;
  onClick?: () => void;
  /**
   * L'identifiant du formulaire de l'écran : le bouton l'ENVOIE (attribut
   * `form`), et Entrée dans un champ aussi — le formulaire reste dans le
   * contenu, son bouton dans le pied.
   */
  form?: string;
  disabled?: boolean;
  /** Une requête en cours : le bouton se désactive et le dit (`pendingLabel`, sinon « Un instant… »). */
  pending?: boolean;
  pendingLabel?: string;
  autoFocus?: boolean;
}

interface WizardFooterProps {
  onBack?: () => void;
  primary?: WizardAction;
  secondary?: readonly WizardAction[];
  /** Une phrase près des boutons : ce qui manque pour continuer, ou ce qui va se passer. */
  status?: ReactNode;
}

const secondaryCls =
  "inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

/**
 * Le pied FIXE de l'assistant : « Retour » à gauche, l'action principale à
 * droite — toujours visibles, quelle que soit la longueur de l'écran (le
 * contenu défile au-dessus, jamais dessous : rien de focalisé n'y est caché).
 * Une seule action principale par écran ; les autres restent discrètes.
 */
export function WizardFooter({ onBack, primary, secondary = [], status }: WizardFooterProps) {
  const { t } = useTranslation("setupWizard");
  return (
    <footer className="shrink-0 border-t border-line-subtle bg-[var(--surface-toolbar)] pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
      <div className="mx-auto flex w-full max-w-[92rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-6 lg:px-10">
        {status ? (
          <div aria-live="polite" className="order-first w-full text-sm leading-snug text-content-tertiary sm:order-none sm:w-auto sm:flex-1 sm:text-right">
            {status}
          </div>
        ) : null}
        {onBack ? (
          <button type="button" onClick={onBack} className={`${secondaryCls} -ml-2 gap-1.5 px-3 sm:order-first`}>
            <ArrowLeft size={16} aria-hidden="true" />
            {t("back")}
          </button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {secondary.map((action) => (
            <ActionButton key={action.label} action={action} className={secondaryCls} />
          ))}
          {primary ? <ActionButton action={primary} className={`${cls.bp} min-w-[8.5rem] px-6`} /> : null}
        </div>
      </div>
    </footer>
  );
}

/** Le bouton d'un geste : `type` d'abord, puis `disabled` (l'ordre que lisent les tests à plat). */
function ActionButton({ action, className }: { action: WizardAction; className: string }) {
  const { t } = useTranslation("setupWizard");
  const busy = action.pending === true;
  return (
    <button
      type={action.form ? "submit" : "button"}
      disabled={busy || action.disabled === true}
      form={action.form}
      onClick={action.onClick}
      autoFocus={action.autoFocus}
      aria-busy={busy || undefined}
      className={className}
    >
      {busy ? (
        <>
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          {action.pendingLabel ?? t("working")}
        </>
      ) : (
        action.label
      )}
    </button>
  );
}
