import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useGenerateTvToken, useRelayConfirm, useDevicePairConfirm } from "@tentacle-tv/api-client";
import { getBackendBase } from "../lib/backendBase";
import { getUserInfo } from "../components/userMenu/menuItems";
import { PairingLockedNotice } from "../components/pair/PairingLockedNotice";
import { PairedDevicesSection } from "../components/admin/PairedDevicesSection";
import { ProvisioningCodeSection } from "../components/admin/ProvisioningCodeSection";
import { MyDevicesSection } from "../components/settings/MyDevicesSection";

/**
 * Résout l'URL serveur à transmettre à la TV au jumelage.
 * Priorité : URL publique du backend (/api/config) → base backend configurée
 * (desktop = tentacle_server_url) → window.location.origin (dernier recours).
 * Évite de graver `tauri://localhost` (desktop) ou une URL LAN/interne dans la TV.
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
    /* réseau indisponible — on garde le fallback */
  }
  return serverUrl;
}

export function PairDevice() {
  const { t } = useTranslation("pairing");
  const { isAdmin } = getUserInfo();
  const tvTokenMut = useGenerateTvToken();
  const relayConfirmMut = useRelayConfirm();
  const deviceConfirmMut = useDevicePairConfirm();

  const [chars, setChars] = useState(["", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "pairing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // État réel du backend : le jumelage n'est possible que si l'URL publique du
  // serveur Tentacle TV est définie. null = en cours de vérification.
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

  const handleChange = useCallback((index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    setChars((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !chars[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [chars]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
    if (pasted.length === 4) {
      setChars(pasted.split(""));
      inputRefs.current[3]?.focus();
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setStatus("pairing");
    setErrorMsg("");

    // 1) Flux local : la TV a généré le code sur CE serveur (config manuelle).
    //    Code inconnu ici (404) → on retombe sur le flux relay public.
    try {
      await deviceConfirmMut.mutateAsync({ code });
      setStatus("success");
      return;
    } catch {
      // pas un code local — on tente le relay
    }

    try {
      const { token } = await tvTokenMut.mutateAsync();

      const serverUrl = await resolvePairingServerUrl();
      const userRaw = localStorage.getItem("tentacle_user");
      const user = userRaw ? JSON.parse(userRaw) as { Id: string; Name: string } : null;
      if (!user?.Id || !user?.Name) throw new Error("User info not found");

      await relayConfirmMut.mutateAsync({
        code,
        serverUrl,
        token,
        user: { id: user.Id, name: user.Name },
      });

      setStatus("success");
    } catch (err) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.includes("invalide") || msg.includes("expire")) {
        setErrorMsg(t("pairing:codeInvalid"));
      } else if (msg.includes("409") || msg.includes("utilise")) {
        setErrorMsg(t("pairing:codeInvalid"));
      } else {
        setErrorMsg(t("pairing:relayError"));
      }
    }
  }, [canSubmit, code, deviceConfirmMut, tvTokenMut, relayConfirmMut, t]);

  const handleReset = useCallback(() => {
    setChars(["", "", "", ""]);
    setStatus("idle");
    setErrorMsg("");
    inputRefs.current[0]?.focus();
  }, []);

  return (
    <div className="px-4 pt-6 pb-12 md:px-12">
      <main className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-xl font-bold text-content-primary sm:text-2xl">
          {t("pairing:pairYourTV")}
        </h1>
        <p className="mb-6 text-sm text-content-tertiary sm:mb-8">
          {t("pairing:enterTVCode")}
        </p>

        {available === false ? (
          <PairingLockedNotice isAdmin={isAdmin} />
        ) : available === null ? (
          <div className="flex justify-center rounded-xl border border-line-subtle bg-fill-faint p-10">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-content-primary" />
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-line-subtle bg-fill-faint p-4 xs:p-6 sm:p-8">
              {status === "success" ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="text-5xl text-status-success-fg">&#x2713;</div>
                  <p className="text-lg font-semibold text-status-success-fg">
                    {t("pairing:tvPairedSuccess")}
                  </p>
                </div>
              ) : (
                <>
                  {/* Code input — taille fluide pour ne jamais déborder sur petits écrans */}
                  <div className="flex justify-center gap-2 xs:gap-3">
                    {chars.map((char, i) => (
                      <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="text"
                        maxLength={1}
                        value={char}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={i === 0 ? handlePaste : undefined}
                        autoFocus={i === 0}
                        disabled={status === "pairing"}
                        className={`h-14 w-12 rounded-xl text-center text-xl font-bold font-mono outline-none transition-all xs:h-16 xs:w-14 xs:text-2xl ${
                          status === "error"
                            ? "bg-danger-surface ring-2 ring-status-error text-content-primary"
                            : char
                            ? "bg-[rgba(var(--brand-rgb),0.1)] ring-2 ring-[var(--brand)] text-content-primary"
                            : "bg-fill-faint ring-1 ring-line-subtle text-content-primary"
                        } focus:ring-2 focus:ring-[var(--brand)] disabled:opacity-50`}
                      />
                    ))}
                  </div>

                  {/* Error message */}
                  {status === "error" && errorMsg && (
                    <p className="mt-4 text-center text-sm text-status-error-fg">
                      {errorMsg}
                    </p>
                  )}

                  {/* Submit / retry button */}
                  <div className="mt-6 flex justify-center">
                    {status === "error" ? (
                      <button
                        onClick={handleReset}
                        className="rounded-lg h-11 px-5 bg-cta-primary-bg text-cta-primary-fg text-sm font-bold transition hover:bg-cta-primary-bg-hover"
                       
                      >
                        {t("common:retry")}
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="rounded-lg h-11 px-5 bg-cta-primary-bg text-cta-primary-fg text-sm font-bold transition hover:bg-cta-primary-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
                       
                      >
                        {status === "pairing" ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cta-primary-fg border-t-transparent" />
                            {t("pairing:pairing")}
                          </span>
                        ) : (
                          t("pairing:pairTV")
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-content-quaternary">
              {t("pairing:codeExpireNote")}
            </p>
          </>
        )}

        {/* Appareils jumelés — l'admin voit ceux de tout le monde (plus le code
            de provisionnement), chacun voit les siens.

            Cette page n'offrait la liste QU'À l'administrateur. Un compte
            ordinaire pouvait donc jumeler un téléviseur ici, et n'avait ensuite
            aucun endroit pour le voir ni le révoquer — la seule liste de ses
            propres appareils était enterrée dans Réglages > Sécurité. */}
        <div className="mt-10">
          {isAdmin ? (
            <>
              <PairedDevicesSection />
              <ProvisioningCodeSection />
            </>
          ) : (
            <MyDevicesSection />
          )}
        </div>
      </main>
    </div>
  );
}
