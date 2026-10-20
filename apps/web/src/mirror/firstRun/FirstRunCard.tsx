import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { LayoutList, Lock, Smile, type LucideIcon } from "lucide-react";
import {
  FIRST_RUN_PROGRESS_KEY, FIRST_RUN_SKIP_KEY, firstRunPrimaryKey, firstRunStepOf, type FirstRunStep, type FirstRunStepDescriptor,
} from "@tentacle-tv/shared";
import { HomeRowsEditor } from "../../components/settings/personalization/HomeRowsEditor";
import { useHomeRowsEditorModel } from "../../components/settings/personalization/useHomeRowsEditorModel";
import { PrimaryCta } from "../screens/misc/shared/PrimaryCta";

/** Les signes du catalogue partagé, en Lucide. */
const STEP_ICONS: Record<FirstRunStepDescriptor["icon"], LucideIcon> = { lock: Lock, layout: LayoutList, smile: Smile };
/** La colonne de lecture (le `CONTENT_MAX_WIDTH` du mobile sur iPad). */
const CONTENT_MAX = 640;

/** « ns:clé » du catalogue → `t()`. */
function useCatalogText() {
  const { t } = useTranslation();
  return (ref: string, options?: Record<string, unknown>) => {
    const at = ref.indexOf(":");
    return at < 0 ? t(ref, options) : t(ref.slice(at + 1), { ns: ref.slice(0, at), ...options });
  };
}

/**
 * Une étape du premier lancement, plein écran — la `FirstRunCard` du mobile,
 * dessinée d'après le catalogue partagé (shared `firstRun/`) : « Étape n sur
 * N » et ses tirets, le signe de l'étape, titre, texte, le contenu dans la
 * page (l'éditeur des rangées de l'accueil), puis un pied FIXE : l'action
 * principale et « Passer » quand l'étape l'offre. Centrée, 640 au plus.
 */
export function FirstRunCard({ step, position, total, onPrimary, onSkip }: {
  step: FirstRunStep;
  position: number;
  total: number;
  onPrimary: () => void;
  onSkip?: () => void;
}) {
  const text = useCatalogText();
  const titleId = useId();
  const primary = useRef<HTMLDivElement>(null);
  const descriptor = firstRunStepOf(step);
  const Icon = STEP_ICONS[descriptor.icon];

  useEffect(() => {
    primary.current?.querySelector("button")?.focus();
  }, [step]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-[80] flex flex-col bg-surface-0">
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5"
        style={{ paddingTop: "calc(max(env(safe-area-inset-top, 0px), 24px) + 16px)" }}
      >
        <div className="mx-auto w-full" style={{ maxWidth: CONTENT_MAX }}>
          <p className="text-[13px] font-semibold text-content-tertiary">{text(FIRST_RUN_PROGRESS_KEY, { current: position, total })}</p>
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {Array.from({ length: total }, (_, index) => (
              <span key={index} className={`h-1 flex-1 rounded-full ${index < position ? "bg-[var(--brand)]" : "bg-fill-medium"}`} />
            ))}
          </div>
          <span
            aria-hidden
            className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl text-cta-brand-fg"
            style={{ backgroundImage: "var(--cta-brand-gradient)" }}
          >
            <Icon size={26} />
          </span>
          <h1 id={titleId} className="mt-5 text-[26px] font-extrabold tracking-[-0.5px] text-content-primary">{text(descriptor.titleKey)}</h1>
          <p className="mt-2 text-[15px] leading-[22px] text-content-secondary">{text(descriptor.bodyKey)}</p>
          {descriptor.inline === "homeRowsEditor" && <HomeRowsStep />}
        </div>
      </div>
      <div
        ref={primary}
        className="border-t border-line-subtle px-5 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <div className="mx-auto flex w-full flex-col gap-2" style={{ maxWidth: CONTENT_MAX }}>
          <PrimaryCta onPress={onPrimary}>{text(firstRunPrimaryKey(step, position === total))}</PrimaryCta>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="min-h-[44px] rounded-lg text-[15px] font-semibold text-content-secondary active:opacity-70"
            >
              {text(FIRST_RUN_SKIP_KEY)}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** « Votre accueil » : l'éditeur des rangées de Réglages › Personnalisation, le même modèle. */
function HomeRowsStep() {
  const { t } = useTranslation("familyMobile");
  const model = useHomeRowsEditorModel();
  if (!model.ready) {
    return <p className="mt-6 text-[13px] text-content-tertiary">{t(model.failed ? "firstRun.homeUnavailable" : "firstRun.homeLoading")}</p>;
  }
  return (
    <div className="mt-6">
      <HomeRowsEditor rows={model.rows} labelFor={model.labelFor} onChange={model.onChange} />
    </div>
  );
}
