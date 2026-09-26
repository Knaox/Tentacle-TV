import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDevicePairConfirm, useGenerateTvToken, useRelayConfirm } from "@tentacle-tv/api-client";
import { getBackendBase } from "../../../../lib/backendBase";
import { pairErrorKey } from "./pairCode";

export type PairStatus = "idle" | "pairing" | "success" | "error";

/**
 * L'URL serveur transmise à la TV : l'URL publique (/api/config), sinon la base
 * du backend, sinon l'origine. Même règle que `pages/PairDevice.tsx`.
 */
async function resolvePairingServerUrl(): Promise<string> {
  const base = getBackendBase();
  let serverUrl = base || window.location.origin;
  try {
    const res = await fetch(`${base}/api/config`);
    if (res.ok) {
      const cfg = await res.json();
      if (cfg?.publicUrl) serverUrl = cfg.publicUrl as string;
    }
  } catch {
    /* réseau indisponible — on garde le repli */
  }
  return serverUrl;
}

/**
 * La logique de jumelage de la page du bureau (`pages/PairDevice.tsx`), sortie
 * en hook pour le miroir : disponibilité (URL publique définie), flux local
 * d'abord, puis le relais public.
 */
export function usePairFlow() {
  const { t } = useTranslation("pairing");
  const tvTokenMut = useGenerateTvToken();
  const relayConfirmMut = useRelayConfirm();
  const deviceConfirmMut = useDevicePairConfirm();
  const [chars, setChars] = useState(["", "", "", ""]);
  const [status, setStatus] = useState<PairStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getBackendBase()}/api/config`);
        const cfg = res.ok ? await res.json() : null;
        if (!cancelled) setAvailable(!!cfg?.publicUrl);
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();
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
      const serverUrl = await resolvePairingServerUrl();
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

  const reset = useCallback(() => {
    setChars(["", "", "", ""]);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  return { chars, setChars, status, errorMsg, available, canSubmit, submit, reset };
}
