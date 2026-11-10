import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon as ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
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

/**
 * Le pied FIXE de l'assistant : « Retour » à gauche, l'action principale à
 * droite — toujours visibles, quelle que soit la longueur de l'écran (le
 * contenu défile au-dessus, jamais dessous : rien de focalisé n'y est caché).
 * Une seule action principale par écran (la pilule pleine) ; les autres
 * restent discrètes (`btn-soft`), « Retour » plus encore (`btn-ghost`).
 */
export function WizardFooter({ onBack, primary, secondary = [], status }: WizardFooterProps) {
  const { t } = useTranslation("setupWizard");
  return (
    <footer className="shrink-0 border-t border-line-subtle bg-surface-1 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
      <div className="mx-auto flex min-h-11 w-full max-w-[92rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-6 lg:px-10">
        {status ? (
          <div aria-live="polite" className="order-first w-full text-sm leading-snug text-content-tertiary sm:order-none sm:w-auto sm:flex-1 sm:text-right">
            {status}
          </div>
        ) : null}
        {onBack ? (
          <button type="button" onClick={onBack} className="btn btn-ghost -ml-2 pl-3.5 sm:order-first">
            <ArrowLeft size={18} aria-hidden="true" />
            {t("back")}
          </button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {secondary.map((action) => (
            <ActionButton key={action.label} action={action} className="btn btn-soft" />
          ))}
          {primary ? <ActionButton action={primary} className={`${cls.bp} min-w-[8.5rem]`} /> : null}
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
