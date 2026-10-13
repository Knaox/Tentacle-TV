import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, UserCog } from "lucide-react";
import { ProfilePinPad } from "./ProfilePinPad";
import { ProfileRow } from "./ProfileRow";
import type { WhoIsWatchingModel } from "./pickerTypes";

export interface WhoIsWatchingViewProps {
  model: WhoIsWatchingModel;
  onPick: (id: string) => void;
  onManage: () => void;
  onRetry: () => void;
  onDigit: (digit: string) => void;
  onErase: () => void;
  /** La flèche du pavé (et Échap) : retour aux profils. */
  onBack: () => void;
}

const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line-subtle bg-fill-soft px-5 text-sm font-semibold text-content-primary transition-colors duration-150 hover:bg-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

/**
 * « Qui regarde ? » sur le bureau — plein écran, AVANT l'application : rien
 * d'autre n'est monté derrière (aucune requête pour un profil qu'on ne
 * choisira peut-être pas). Quatre visages, que l'intégration choisit :
 * `loading`, `error`, `picker` (la rangée, « Gérer les profils » dessous),
 * `pin` (le pavé du profil choisi, sa flèche de retour en haut à gauche).
 *
 * Coût GPU : le fond est FIXE — deux dégradés radiaux peints une fois, comme
 * l'écran de connexion ; seules les tuiles bougent, et seulement au survol, au
 * focus ou à l'entrée dans un profil.
 */
export const WhoIsWatchingView = memo(function WhoIsWatchingView(props: WhoIsWatchingViewProps) {
  const { model } = props;
  const { t } = useTranslation("profilePicker");
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-clip bg-surface-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(70% 55% at 50% 0%, rgba(var(--brand-rgb), 0.20) 0%, rgba(var(--brand-rgb), 0.04) 50%, transparent 75%)," +
            "radial-gradient(55% 50% at 50% 100%, rgba(var(--brand-accent-rgb), 0.12) 0%, transparent 70%)",
        }}
      />
      {model.kind === "pin" && (
        <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
          <button type="button" onClick={props.onBack} className={SECONDARY}>
            <ArrowLeft size={16} aria-hidden />
            {t("pin.back")}
          </button>
        </div>
      )}
      <main key={model.kind} className="flex flex-1 flex-col items-center justify-center px-6 py-16 animate-fade-slide-up">
        {model.kind === "loading" && <Status text={t("loading")} busy />}
        {model.kind === "error" && (
          <div className="flex flex-col items-center text-center">
            <h1 className="text-2xl font-bold tracking-tight text-content-primary">{t("whoIsWatching")}</h1>
            <p role="alert" className="mt-3 max-w-md text-sm text-content-tertiary">{model.message}</p>
            <button type="button" onClick={props.onRetry} className={`${SECONDARY} mt-6`} autoFocus>
              {t("retry")}
            </button>
          </div>
        )}
        {model.kind === "picker" && (
          <>
            <h1 className="text-4xl font-extrabold tracking-tight text-content-primary md:text-5xl">{t("whoIsWatching")}</h1>
            <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm text-content-tertiary">
              {model.entering?.label ?? model.notice ?? ""}
            </p>
            <div className="mt-8">
              <ProfileRow profiles={model.profiles} enteringId={model.entering?.id ?? null} onPick={props.onPick} />
            </div>
            {model.canManage && (
              <button
                type="button"
                onClick={props.onManage}
                disabled={model.entering !== null}
                className={`${SECONDARY} mt-12 transition-opacity duration-200 disabled:pointer-events-none disabled:opacity-0`}
              >
                <UserCog size={16} aria-hidden />
                {t("manageProfiles")}
              </button>
            )}
          </>
        )}
        {model.kind === "pin" && (
          <ProfilePinPad pad={model.pad} onDigit={props.onDigit} onErase={props.onErase} onBack={props.onBack} />
        )}
      </main>
    </div>
  );
});

function Status({ text, busy }: { text: string; busy?: boolean }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 text-sm text-content-tertiary">
      {busy && <span aria-hidden className="h-8 w-8 animate-spin rounded-full border-[3px] border-line-subtle border-t-[var(--brand)]" />}
      {text}
    </div>
  );
}
