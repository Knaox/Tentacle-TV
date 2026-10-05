import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAutoSubmitPairingCode,
  useDevicePairConfirm,
  useGenerateTvToken,
  useRelayConfirm,
  type PairingEntryStatus,
  type StorageAdapter,
} from "@tentacle-tv/api-client";
import { pairingErrorKey } from "../../hooks/usePairingAvailability";

const EMPTY = ["", "", "", ""];

/** L'URL transmise à la TV : l'URL publique du serveur (joignable de l'extérieur), sinon `base`. */
async function publicServerUrl(base: string): Promise<string> {
  try {
    const res = await fetch(`${base}/api/config`);
    if (res.ok) {
      const cfg = await res.json();
      if (cfg?.publicUrl) return cfg.publicUrl as string;
    }
  } catch {
    /* réseau indisponible — on garde `base` */
  }
  return base;
}

/**
 * Le jumelage d'une TV depuis le téléphone : le code qu'elle affiche, validé
 * dès le DERNIER caractère (`useAutoSubmitPairingCode`). Comme le web : le
 * code généré par CE serveur d'abord (« Jumeler avec un code » d'une TV
 * configurée à la main), sinon le relais public.
 */
export function usePairTvFlow(storage: StorageAdapter) {
  const { t } = useTranslation("pairing");
  const { t: te } = useTranslation("errors");
  const tvTokenMut = useGenerateTvToken();
  const relayConfirmMut = useRelayConfirm();
  const deviceConfirmMut = useDevicePairConfirm();
  const [chars, setRawChars] = useState(EMPTY);
  const [status, setStatus] = useState<PairingEntryStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

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
      const base = storage.getItem("tentacle_server_url") ?? "";
      if (!base) throw new Error(te("noServerUrl"));
      const serverUrl = await publicServerUrl(base);
      const userRaw = storage.getItem("tentacle_user");
      const user = userRaw ? (JSON.parse(userRaw) as { Id: string; Name: string }) : null;
      if (!user?.Id || !user?.Name) throw new Error(te("userInfoNotFound"));
      await relayConfirmMut.mutateAsync({ code, serverUrl, token, user: { id: user.Id, name: user.Name } });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(t(pairingErrorKey(err)));
    }
  }, [canSubmit, code, deviceConfirmMut, tvTokenMut, relayConfirmMut, storage, t, te]);

  // Le dernier caractère lance le jumelage, sans bouton à presser.
  useAutoSubmitPairingCode(code, status, submit);

  // Corriger une case après un refus remet au repos : le code repart, complet.
  const setChars = useCallback((next: string[]) => {
    setStatus((current) => (current === "error" ? "idle" : current));
    setErrorMsg("");
    setRawChars(next);
  }, []);

  const reset = useCallback(() => {
    setRawChars(EMPTY);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  return { chars, setChars, status, errorMsg, canSubmit, submit, reset };
}
