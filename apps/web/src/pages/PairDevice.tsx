import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useGenerateTvToken, useRelayConfirm } from "@tentacle-tv/api-client";

export function PairDevice() {
  const { t } = useTranslation("pairing");
  const tvTokenMut = useGenerateTvToken();
  const relayConfirmMut = useRelayConfirm();

  const [chars, setChars] = useState(["", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "pairing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

    try {
      const { token } = await tvTokenMut.mutateAsync();

      const serverUrl = window.location.origin;
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
  }, [canSubmit, code, tvTokenMut, relayConfirmMut, t]);

  const handleReset = useCallback(() => {
    setChars(["", "", "", ""]);
    setStatus("idle");
    setErrorMsg("");
    inputRefs.current[0]?.focus();
  }, []);

  return (
    <div className="px-4 pt-6 pb-12 md:px-12">
      <main className="mx-auto max-w-lg">
        <h1 className="mb-2 text-2xl font-bold text-white">
          {t("pairing:pairYourTV")}
        </h1>
        <p className="mb-8 text-sm text-white/50">
          {t("pairing:enterTVCode")}
        </p>

        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-8">
          {status === "success" ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="text-5xl text-green-400">&#x2713;</div>
              <p className="text-lg font-semibold text-green-400">
                {t("pairing:tvPairedSuccess")}
              </p>
            </div>
          ) : (
            <>
              {/* Code input */}
              <div className="flex justify-center gap-3">
                {chars.map((char, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    maxLength={1}
                    value={char}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    autoFocus={i === 0}
                    disabled={status === "pairing"}
                    className={`h-16 w-14 rounded-xl text-center text-2xl font-bold font-mono outline-none transition-all ${
                      status === "error"
                        ? "bg-red-500/10 ring-2 ring-red-500 text-white"
                        : char
                        ? "bg-purple-500/10 ring-2 ring-purple-500 text-white"
                        : "bg-white/[0.03] ring-1 ring-white/10 text-white"
                    } focus:ring-2 focus:ring-purple-400 disabled:opacity-50`}
                  />
                ))}
              </div>

              {/* Error message */}
              {status === "error" && errorMsg && (
                <p className="mt-4 text-center text-sm text-red-400">
                  {errorMsg}
                </p>
              )}

              {/* Submit / retry button */}
              <div className="mt-6 flex justify-center">
                {status === "error" ? (
                  <button
                    onClick={handleReset}
                    className="rounded-lg bg-purple-600 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500"
                  >
                    {t("common:retry")}
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="rounded-lg bg-purple-600 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {status === "pairing" ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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

        <p className="mt-6 text-center text-xs text-white/30">
          {t("pairing:codeExpireNote")}
        </p>
      </main>
    </div>
  );
}
