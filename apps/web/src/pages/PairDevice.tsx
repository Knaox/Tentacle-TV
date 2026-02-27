import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useGeneratePairingCode, usePairingStatus } from "@tentacle/api-client";

export function PairDevice() {
  const { t } = useTranslation("pairing");
  const generateMut = useGeneratePairingCode();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState(300);

  const expired = remaining <= 0;

  // Poll status to detect when TV claims the code
  const { data: statusData } = usePairingStatus(code && !expired ? code : null);
  const claimed = statusData?.status === "confirmed";

  const generate = useCallback(() => {
    setCode(null);
    setRemaining(300);
    generateMut.mutate(undefined, {
      onSuccess: (data) => {
        setCode(data.code);
        setExpiresAt(new Date(data.expiresAt));
      },
    });
  }, [generateMut]);

  // Generate on mount
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setRemaining(diff);
      if (diff <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = expiresAt ? Math.max(0, remaining / 300) : 1;

  return (
    <div className="px-4 pt-6 pb-12 md:px-12">
      <main className="mx-auto max-w-lg">
        <h1 className="mb-2 text-2xl font-bold text-white">{t("pairing:pairDevice")}</h1>
        <p className="mb-8 text-sm text-white/50">
          {t("pairing:enterCode")}
        </p>

        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-8">
          {/* Claimed / success state */}
          {claimed ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="text-5xl text-green-400">✓</div>
              <p className="text-lg font-semibold text-green-400">{t("pairing:pairingSuccess")}</p>
            </div>
          ) : !code ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Code display */}
              <div className="flex justify-center gap-3">
                {code.split("").map((char, i) => (
                  <div
                    key={i}
                    className={`flex h-16 w-14 items-center justify-center rounded-xl text-2xl font-bold font-mono transition-all ${
                      expired
                        ? "bg-white/[0.03] ring-1 ring-white/10 text-white/25"
                        : "bg-purple-500/10 ring-2 ring-purple-500 text-white"
                    }`}
                  >
                    {char}
                  </div>
                ))}
              </div>

              {/* Timer */}
              <p className={`mt-4 text-center text-sm ${expired ? "text-red-400" : "text-white/40"}`}>
                {expired
                  ? t("pairing:codeExpired")
                  : t("pairing:expiresIn", { time: `${minutes}:${seconds.toString().padStart(2, "0")}` })}
              </p>

              {/* Progress bar */}
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-1000"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </>
          )}

          {/* Generate new code */}
          {expired && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={generate}
                className="rounded-lg bg-purple-600 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                {t("pairing:generateNewCode")}
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          {t("pairing:codeExpireNote")}
        </p>
      </main>
    </div>
  );
}
