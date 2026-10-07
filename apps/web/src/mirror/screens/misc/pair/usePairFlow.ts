import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAutoSubmitPairingCode, useDevicePairConfirm, useGenerateTvToken, useRelayConfirm } from "@tentacle-tv/api-client";
import { fetchPairingServerUrl } from "../../../../lib/pairingServerUrl";
import { pairErrorKey } from "./pairCode";

export type PairStatus = "idle" | "pairing" | "success" | "error";

/**
 * La logique de jumelage de la page du bureau (`pages/PairDevice.tsx`), sortie
 * en hook pour le miroir : disponibilité (une adresse qu'une TV puisse
 * joindre — l'annoncée ou la nôtre, `fetchPairingServerUrl`), flux local
 * d'abord, puis le relais public.
 */
export function usePairFlow() {
  const { t } = useTranslation("pairing");
  const tvTokenMut = useGenerateTvToken();
  const relayConfirmMut = useRelayConfirm();
  const deviceConfirmMut = useDevicePairConfirm();
  const [chars, setRawChars] = useState(["", "", "", ""]);
  const [status, setStatus] = useState<PairStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPairingServerUrl().then((url) => {
      if (!cancelled) setAvailable(url !== null);
    });
    return () => { cancelled = true; };
  }, []);

  const code = chars.join("");
  const canSubmit = code.length === 4 && status === "idle";

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setStatus("pairing");
    setErrorMsg("");
    // 1) Code généré par la TV sur CE serveur ; inconnu ici → le relais.
    try {
      await deviceConfirmMut.mutateAsync({ code });
      setStatus("success");
      return;
    } catch {
      /* pas un code local */
    }
    try {
      const { token } = await tvTokenMut.mutateAsync();
      const serverUrl = await fetchPairingServerUrl();
      if (!serverUrl) throw new Error("No reachable server URL");
      const userRaw = localStorage.getItem("tentacle_user");
      const user = userRaw ? (JSON.parse(userRaw) as { Id: string; Name: string }) : null;
      if (!user?.Id || !user?.Name) throw new Error("User info not found");
      await relayConfirmMut.mutateAsync({ code, serverUrl, token, user: { id: user.Id, name: user.Name } });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(t(pairErrorKey(err instanceof Error ? err.message : String(err))));
    }
  }, [canSubmit, code, deviceConfirmMut, tvTokenMut, relayConfirmMut, t]);

  // Le dernier caractère saisi (ou le code collé) lance le jumelage.
  useAutoSubmitPairingCode(code, status, submit);

  // Corriger une case après un refus remet au repos : le code repart, complet.
  const setChars = useCallback((next: string[]) => {
    setStatus((current) => (current === "error" ? "idle" : current));
    setErrorMsg("");
    setRawChars(next);
  }, []);

  const reset = useCallback(() => {
    setRawChars(["", "", "", ""]);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  return { chars, setChars, status, errorMsg, available, canSubmit, submit, reset };
}
