import { useCallback, useEffect, useRef, useState } from "react";
import { copyText } from "../lib/clipboard";

export type CopyStatus = "idle" | "copied" | "failed";

/** Durée d'affichage de « Copié ! ». */
const COPIED_MS = 2_000;

/**
 * Copier, et le DIRE. « Copié » s'efface de lui-même ; « échec » reste jusqu'au
 * prochain essai, parce que c'est lui qui explique comment finir à la main —
 * un message qui s'éteint avant d'avoir été lu ne sert à rien.
 */
export function useCopyFeedback(): { status: CopyStatus; copy: (text: string) => Promise<boolean> } {
  // L'horodatage relance la minuterie à chaque réussite, même consécutive.
  const [state, setState] = useState<{ status: CopyStatus; at: number }>({ status: "idle", at: 0 });
  // Deux appuis rapprochés : seul le dernier décide de ce qui s'affiche.
  const attempt = useRef(0);

  useEffect(() => {
    if (state.status !== "copied") return;
    const id = setTimeout(() => setState({ status: "idle", at: Date.now() }), COPIED_MS);
    return () => clearTimeout(id);
  }, [state]);

  const copy = useCallback(async (text: string) => {
    const mine = ++attempt.current;
    const ok = await copyText(text);
    if (mine === attempt.current) setState({ status: ok ? "copied" : "failed", at: Date.now() });
    return ok;
  }, []);

  return { status: state.status, copy };
}
