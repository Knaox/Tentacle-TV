import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAutoUpdate, type UpdatePhase } from "../hooks/useAutoUpdate";

function Spinner() {
  return (
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <defs>
        <linearGradient id="sparkleGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A855F7" />
          <stop offset="1" stopColor="var(--brand-accent)" />
        </linearGradient>
      </defs>
      <path
        d="M12 2l2.39 6.04L20.5 9.5l-4.55 3.96L17.39 20 12 16.27 6.61 20l1.44-6.54L3.5 9.5l6.11-1.46L12 2z"
        fill="url(#sparkleGrad)"
      />
    </svg>
  );
}

/**
 * Barre de progression, déterminée ou non.
 *
 * Le mode INDÉTERMINÉ n'est pas un pis-aller : sous Windows c'est le Microsoft
 * Store qui télécharge et installe, et il n'expose son avancement qu'à un
 * délégué WinRT hors de portée d'un pont FFI. La coquille annonçait donc 0 puis
 * 100, et la barre restait plantée à zéro pendant tout le téléchargement — ce
 * qui se lit comme une panne. Une bande qui balaie dit la vérité : il se passe
 * quelque chose, on ne sait pas où ça en est.
 *
 * Elle balaie en `transform`, jamais en `background-position` ni en `width` :
 * l'une repeindrait la barre à chaque image, l'autre provoquerait une mise en
 * page. C'est la règle du dépôt, et elle vaut aussi pour une barre de 2,5 px.
 */
function ProgressBar({ progress, indeterminate }: { progress: number; indeterminate?: boolean }) {
  if (indeterminate) {
    return (
      <div className="w-full space-y-2">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-fill-soft">
          <div
            className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]"
            style={{ animation: "indeterminateSweep 1.4s ease-in-out infinite" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-fill-soft">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-center text-xs font-medium text-content-tertiary">{progress}%</p>
    </div>
  );
}

function ModalContent({
  phase,
  notes,
  progress,
  indeterminate,
  error,
  isStoreUpdate,
  storeOpened,
  onInstall,
  onDismiss,
  t,
}: {
  phase: UpdatePhase;
  notes?: string;
  progress: number;
  indeterminate: boolean;
  error: string | null;
  isStoreUpdate: boolean;
  storeOpened: boolean;
  onInstall: () => void;
  onDismiss: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (phase === "downloading") {
    return (
      <div className="space-y-4 py-2">
        <ProgressBar progress={progress} indeterminate={indeterminate} />
        <p className="text-center text-sm text-content-tertiary">
          {indeterminate
            ? t("notifications:downloadingByStore")
            : t("notifications:downloading", { progress })}
        </p>
        <p className="text-center text-xs text-content-quaternary">{t("notifications:restartHint")}</p>
      </div>
    );
  }

  if (phase === "installing") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Spinner />
        <p className="text-sm text-content-secondary">{t("notifications:updateInstalling")}</p>
      </div>
    );
  }

  if (phase === "restarting") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Spinner />
        <p className="text-sm text-content-secondary">{t("notifications:updateRestarting")}</p>
      </div>
    );
  }

  // phase === "available"
  return (
    <>
      {notes && (
        <div className="max-h-32 overflow-y-auto rounded-lg bg-fill-subtle p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-content-quaternary">
            {t("notifications:updateReleaseNotes")}
          </p>
          <p className="whitespace-pre-line text-sm text-content-tertiary">{notes}</p>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-danger-border bg-danger-surface p-3">
          {/* Les codes connus de la coquille arrivent sous forme de clé i18n
              (cf. `updateErrorLabel`). Le reste est un message brut : on
              l'affiche tel quel plutôt que de taire l'erreur. */}
          <p className="text-sm text-status-error-fg">
            {error.startsWith("notifications:") ? t(error) : error}
          </p>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onInstall}
          className="flex-1 rounded-xl bg-cta-primary-bg px-4 py-2.5 text-sm font-bold text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover"
        >
          {isStoreUpdate ? t("notifications:updateOpenStore") : t("notifications:updateNow")}
        </button>
        <button
          onClick={onDismiss}
          className="rounded-xl bg-fill-subtle px-4 py-2.5 text-sm text-content-tertiary transition-colors hover:bg-fill-soft"
        >
          {t("notifications:later")}
        </button>
      </div>
      {isStoreUpdate && storeOpened && (
        <p className="text-center text-xs text-content-quaternary">{t("notifications:updateStoreOpenedHint")}</p>
      )}
    </>
  );
}

export function UpdateModal() {
  const { t } = useTranslation("notifications");
  const { available, phase, version, notes, progress, indeterminate, error, isStoreUpdate, storeOpened, installUpdate, dismiss } = useAutoUpdate();


  if (!available) return null;

  const canClose = phase === "available";

  return createPortal(
    <div
      // Scrim de modale : reste sombre dans les deux thèmes (règle scrim).
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={canClose ? dismiss : undefined}
    >
      <div
        // Fond du panneau : littéral hors table (implémentation ad hoc) — non migré.
        className="mx-4 w-full max-w-md space-y-4 rounded-2xl border border-line-subtle bg-surface-modal p-6 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SparkleIcon />
            <h2 className="text-lg font-semibold text-content-primary">
              {t("notifications:updateAvailable")}
            </h2>
          </div>
          {version && (
            <span className="rounded-full bg-[rgba(var(--brand-rgb),0.2)] px-3 py-0.5 text-xs font-medium text-[var(--brand-light)]">
              v{version}
            </span>
          )}
        </div>

        <ModalContent
          phase={phase}
          notes={notes}
          progress={progress}
          indeterminate={indeterminate}
          error={error}
          isStoreUpdate={isStoreUpdate}
          storeOpened={storeOpened}
          onInstall={installUpdate}
          onDismiss={dismiss}
          t={t}
        />
      </div>
    </div>,
    document.body,
  );
}
