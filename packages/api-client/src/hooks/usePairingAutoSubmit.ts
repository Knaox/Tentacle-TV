import { useEffect, useRef } from "react";

/** La longueur du code qu'affiche la TV (local comme relais). */
export const PAIRING_CODE_LENGTH = 4;

export type PairingEntryStatus = "idle" | "pairing" | "success" | "error";

/**
 * Faut-il lancer le jumelage tout seul ? Oui quand le DERNIER caractère vient
 * d'être saisi (ou le code collé), au repos, et pas déjà tenté pour ce même
 * code — une seule tentative par code complet, jamais une boucle.
 */
export function shouldAutoSubmitPairingCode(code: string, status: PairingEntryStatus, lastTried: string | null): boolean {
  return code.length === PAIRING_CODE_LENGTH && status === "idle" && code !== lastTried;
}

/**
 * Le jumelage part à la saisie du dernier caractère, sans bouton à presser
 * (web, bureau, miroir, mobile). Un code redevenu incomplet (effacé, corrigé
 * après un refus) peut repartir une fois complet.
 */
export function useAutoSubmitPairingCode(code: string, status: PairingEntryStatus, submit: () => unknown): void {
  const lastTried = useRef<string | null>(null);
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (code.length < PAIRING_CODE_LENGTH) lastTried.current = null;
    if (!shouldAutoSubmitPairingCode(code, status, lastTried.current)) return;
    lastTried.current = code;
    void submitRef.current();
  }, [code, status]);
}
