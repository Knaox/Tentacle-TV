import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAutoSubmitPairingCode, useGenerateTvToken, useRelayConfirm, useDevicePairConfirm } from "@tentacle-tv/api-client";
import { accountConnectRefusalOf } from "@tentacle-tv/shared";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { BackButton } from "../components/ui/BackButton";
import { fetchPairingServerUrl } from "../lib/pairingServerUrl";
import { getUserInfo } from "../components/userMenu/menuItems";
import { PairingLockedNotice } from "../components/pair/PairingLockedNotice";
import { PairedDevicesSection } from "../components/admin/PairedDevicesSection";
import { ProvisioningCodeSection } from "../components/admin/ProvisioningCodeSection";
import { MyDevicesSection } from "../components/settings/MyDevicesSection";

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

  // Le jumelage exige une adresse qu'une TV puisse joindre : celle que le
  // serveur annonce, sinon celle par laquelle on lui parle (réseau local, sans
  // lien public). null = en cours de vérification.
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

  // Corriger une case après un refus remet au repos : le code repart, complet.
  const backToIdle = useCallback(() => {
    setStatus((current) => (current === "error" ? "idle" : current));
    setErrorMsg("");
  }, []);

  const handleChange = useCallback((index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    backToIdle();
    setChars((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [backToIdle]);

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
      backToIdle();
      setChars(pasted.split(""));
      inputRefs.current[3]?.focus();
    }
  }, [backToIdle]);

  /** Désactivé, hors plage, trop de sessions (docs/DROITS-UTILISATEURS.md § 9.1) : la raison, en mots. */
  const showRefusal = useCallback((err: unknown): boolean => {
    const refusal = accountConnectRefusalOf((err as { refusal?: unknown } | null)?.refusal);
    if (!refusal) return false;
    setStatus("error");
    setErrorMsg(t(`accountAccess:refusals.${refusal.code}`, { count: refusal.maxSessions ?? 1 }));
    return true;
  }, [t]);

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
    } catch (err) {
      // Un jumelage refusé par le serveur (trop de sessions…) : dit en mots, pas de relais.
      if (showRefusal(err)) return;
      // pas un code local — on tente le relay
    }

    try {
      const { token } = await tvTokenMut.mutateAsync();

      const serverUrl = await fetchPairingServerUrl();
      if (!serverUrl) throw new Error("No reachable server URL");
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
      if (showRefusal(err)) return;
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
  }, [canSubmit, code, deviceConfirmMut, tvTokenMut, relayConfirmMut, t, showRefusal]);

  // Le dernier caractère saisi (ou le code collé) lance le jumelage : le
  // bouton reste pour qui préfère le presser.
  useAutoSubmitPairingCode(code, status, handleSubmit);

  const handleReset = useCallback(() => {
    setChars(["", "", "", ""]);
    setStatus("idle");
    setErrorMsg("");
    inputRefs.current[0]?.focus();
  }, []);

  return (
    <div className="px-4 pt-6 pb-12 md:px-12">
      <main className="mx-auto max-w-4xl">
        <header className="mb-7 flex items-start gap-3">
          <BackButton fallback="/" className="-ml-1 shrink-0" />
          <div className="min-w-0 pt-0.5">
            <h1 className="text-[1.875rem] font-[650] leading-[1.15] tracking-[-0.02em] text-content-primary">
              {t("pairing:pairYourTV")}
            </h1>
            <p className="mt-1.5 max-w-[65ch] text-sm leading-relaxed text-content-secondary">
              {t("pairing:enterTVCode")}
            </p>
          </div>
        </header>

        {available === false ? (
          <PairingLockedNotice isAdmin={isAdmin} />
        ) : available === null ? (
          <div className="ui-panel flex justify-center p-10">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-fill-medium border-t-accent" />
          </div>
        ) : (
          <>
            <div className="ui-panel p-4 xs:p-6 sm:p-8">
              {status === "success" ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="text-status-success-fg"><CheckCircleIcon size={48} weight="fill" aria-hidden /></div>
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
                        className={`h-14 w-12 rounded-card text-center font-mono text-xl font-bold text-content-primary outline-none transition-colors duration-hover xs:h-16 xs:w-14 xs:text-2xl ${
                          status === "error"
                            ? "bg-danger-surface ring-2 ring-status-error"
                            : char
                            ? "bg-surface-3 ring-1 ring-line-strong"
                            : "bg-surface-2 ring-1 ring-line-subtle"
                        } focus:ring-2 focus:ring-line-focus disabled:opacity-50`}
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
                        className="btn btn-solid"
                      >
                        {t("common:retry")}
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="btn btn-solid"
                      >
                        {status === "pairing" ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
