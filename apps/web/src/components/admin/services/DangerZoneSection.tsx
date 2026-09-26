import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { cls } from "../../../pages/adminUtils";
import { Modal } from "../../ui/Modal";
import { AdminSection } from "../kit";
import { servicesApi } from "./servicesApi";
import { matchesConfirmation } from "./serviceSummary";
import { useExplainFailure } from "./useServicesData";

/**
 * La zone de danger : la réinitialisation du serveur, à part.
 *
 * Elle vivait DANS la carte de la base de données, sous son bouton
 * « Sauvegarder », confirmée par un second clic au même endroit — deux clics
 * trop proches d'un geste ordinaire pour une action qui efface toute la
 * configuration et déjumelle tous les appareils. Elle a désormais sa section,
 * bordée de rouge, et sa confirmation exige de TAPER un mot : on ne la
 * déclenche plus en cliquant deux fois de suite par inadvertance.
 */
export function DangerZoneSection() {
  const { t } = useTranslation("adminServices");
  const [open, setOpen] = useState(false);

  return (
    <AdminSection id="danger" tone="danger" title={t("dangerTitle")} description={t("dangerDescription")}>
      <div className="flex flex-col gap-4 rounded-xl bg-status-error-bg p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-content-primary">{t("resetTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-content-secondary">{t("resetDescription")}</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className={`${cls.bd} shrink-0`}>
          {t("resetAction")}
        </button>
      </div>
      <ResetServerDialog open={open} onClose={() => setOpen(false)} />
    </AdminSection>
  );
}

function ResetServerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("adminServices");
  const explain = useExplainFailure();
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const word = t("resetConfirmWord");

  const reset = useMutation({
    mutationFn: servicesApi.resetServer,
    onSuccess: () => {
      // Le serveur repart en installation : la session d'administrateur ne
      // mène plus nulle part, l'application recharge sur l'assistant.
      localStorage.removeItem("tentacle_user");
      window.location.reload();
    },
    onError: (error) => setFailure(t("resetFailed", { message: explain(error) })),
  });
  const confirmed = matchesConfirmation(typed, word);

  const close = () => {
    if (reset.isPending) return;
    setTyped("");
    setFailure(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      maxWidth={480}
      dismissOnBackdrop={!reset.isPending}
      labelledBy={titleId}
      describedBy={descriptionId}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (confirmed && !reset.isPending) reset.mutate();
        }}
        className="p-6"
      >
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-error-bg text-status-error-fg">
            <TriangleAlert size={20} />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{t("resetConfirmTitle")}</h2>
            <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-content-tertiary">{t("resetConfirmBody")}</p>
          </div>
        </div>
        <label htmlFor={inputId} className="mt-5 block text-sm text-content-secondary">
          {t("resetConfirmPrompt", { word })}
        </label>
        <input
          id={inputId}
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            setFailure(null);
          }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={reset.isPending}
          className={`${cls.inp} mt-2`}
        />
        {failure && <p role="alert" className="mt-3 text-sm text-status-error-fg">{failure}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={close} disabled={reset.isPending} className={cls.bs}>{t("cancel")}</button>
          <button type="submit" disabled={!confirmed || reset.isPending} className={cls.bd}>
            {reset.isPending ? t("resetting") : t("resetConfirm")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
