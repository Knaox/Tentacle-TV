/**
 * Octave — la règle de doublon d'un ajout GROUPÉ : « 2 des 5 titres sont déjà dans X ». Trois issues — tout
 * ajouter, ajouter sans les doublons, ou ne rien faire (Échap, clic à côté) ; quand TOUS sont déjà là, il n'en
 * reste que deux. Une seule boîte pour tout Octave, montée par la coquille (comme `DuplicateConfirmHost`).
 */

import { useId, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../../../../components/ui/Modal";
import { GlassButton } from "../../../../components/ui/glass/GlassButton";
import type { DuplicateChoice } from "./bulkRules";

interface Ask {
  duplicates: number;
  total: number;
  playlist: string;
  resolve: (choice: DuplicateChoice) => void;
}

let current: Ask | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function askBulkDuplicates(duplicates: number, total: number, playlist: string): Promise<DuplicateChoice> {
  current?.resolve("cancel");
  return new Promise((resolve) => {
    current = { duplicates, total, playlist, resolve };
    notify();
  });
}

/** La réponse de l'utilisateur (la boîte, et les tests). */
export function answerBulkDuplicates(choice: DuplicateChoice): void {
  const ask = current;
  current = null;
  notify();
  ask?.resolve(choice);
}

const BUTTON = "inline-flex h-11 items-center justify-center px-5 text-sm font-semibold disabled:opacity-50";
const QUIET_FALLBACK = "rounded-lg border border-line-subtle bg-fill-soft text-content-primary transition hover:bg-fill-medium";

export function BulkDuplicateHost() {
  const { t } = useTranslation("music");
  const titleId = useId();
  const descId = useId();
  const ask = useSyncExternalStore(subscribe, () => current, () => null);
  const allThere = ask !== null && ask.duplicates >= ask.total;
  return (
    <Modal open={ask !== null} onClose={() => answerBulkDuplicates("cancel")} maxWidth={540} labelledBy={titleId} describedBy={descId}>
      {ask && (
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{t("playlist.duplicateTitle")}</h2>
          <p id={descId} className="mt-2 text-sm leading-relaxed text-content-tertiary">
            {allThere ? t("selection.allDuplicates", { count: ask.total, name: ask.playlist }) : t("selection.someDuplicates", { count: ask.duplicates, total: ask.total, name: ask.playlist })}
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <GlassButton inSurface onClick={() => answerBulkDuplicates("cancel")} appearance={{ level: "regular", shape: "capsule" }} className={BUTTON} fallbackClassName={QUIET_FALLBACK}>
              {t("playlist.duplicateCancel")}
            </GlassButton>
            {!allThere && (
              <GlassButton inSurface onClick={() => answerBulkDuplicates("skip")} appearance={{ level: "regular", shape: "capsule" }} className={BUTTON} fallbackClassName={QUIET_FALLBACK}>
                {t("selection.skipDuplicates")}
              </GlassButton>
            )}
            <GlassButton
              inSurface
              onClick={() => answerBulkDuplicates("all")}
              appearance={{ level: "prominent", tint: "brand", shape: "capsule" }}
              className={`${BUTTON} font-bold`}
              fallbackClassName="rounded-lg bg-cta-primary-bg text-cta-primary-fg transition hover:bg-cta-primary-bg-hover"
            >
              {t("playlist.duplicateConfirm")}
            </GlassButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
