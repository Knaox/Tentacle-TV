/**
 * Octave — « Déjà dans la playlist — l'ajouter quand même ? » (retour de Damien du 25/10) : un doublon reste
 * permis, jamais par mégarde. Une seule boîte pour tout Octave, montée par la coquille ; les gestes la demandent
 * par `askDuplicate` (une promesse : `true` = ajouter quand même). Une demande nouvelle remplace l'ancienne,
 * qui se résout en « non ».
 */

import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

interface Ask {
  title: string;
  playlist: string;
  resolve: (confirmed: boolean) => void;
}

let current: Ask | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function askDuplicate(title: string, playlist: string): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { title, playlist, resolve };
    notify();
  });
}

/** La réponse de l'utilisateur (la boîte, et les tests). */
export function answerDuplicate(confirmed: boolean): void {
  const ask = current;
  current = null;
  notify();
  ask?.resolve(confirmed);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function DuplicateConfirmHost() {
  const { t } = useTranslation("music");
  const ask = useSyncExternalStore(subscribe, () => current, () => null);
  return (
    <ConfirmDialog
      open={ask !== null}
      title={t("playlist.duplicateTitle")}
      message={ask ? t("playlist.duplicateMessage", { title: ask.title, name: ask.playlist }) : ""}
      confirmLabel={t("playlist.duplicateConfirm")}
      cancelLabel={t("playlist.duplicateCancel")}
      onConfirm={() => answerDuplicate(true)}
      onCancel={() => answerDuplicate(false)}
    />
  );
}
