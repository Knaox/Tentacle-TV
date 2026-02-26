import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useConfirmPairing } from "@tentacle/api-client";

export function PairDevice() {
  const { t } = useTranslation("pairing");
  const [chars, setChars] = useState(["", "", "", ""]);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmMut = useConfirmPairing();

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Reset on error
  useEffect(() => {
    if (confirmMut.isError) {
      setChars(["", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }, [confirmMut.isError]);

  const updateChar = (index: number, value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z2-9]/g, "");
    if (!upper) return;

    const next = [...chars];
    next[index] = upper[0];
    setChars(next);

    // Auto-advance to next field
    if (index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (chars[index]) {
        const next = [...chars];
        next[index] = "";
        setChars(next);
      } else if (index > 0) {
        const next = [...chars];
        next[index - 1] = "";
        setChars(next);
        inputRefs.current[index - 1]?.focus();
      }
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .toUpperCase()
      .replace(/[^A-Z2-9]/g, "")
      .slice(0, 4);
    if (!pasted) return;

    const next = ["", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setChars(next);

    const focusIdx = Math.min(pasted.length, 3);
    inputRefs.current[focusIdx]?.focus();
  };

  const code = chars.join("");
  const canSubmit = code.length === 4 && !confirmMut.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    confirmMut.mutate(code, {
      onSuccess: (data) => {
        setSuccess(t("pairing:pairSuccess", { name: data.deviceName }));
        setChars(["", "", "", ""]);
      },
    });
  };

  return (
    <div className="px-4 pt-6 pb-12 md:px-12">
      <main className="mx-auto max-w-lg">
        <h1 className="mb-2 text-2xl font-bold text-white">{t("pairing:pairDevice")}</h1>
        <p className="mb-8 text-sm text-white/50">
          {t("pairing:enterCode")}
        </p>

        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-8">
          {/* Code inputs */}
          <div className="flex justify-center gap-3" onPaste={handlePaste}>
            {chars.map((char, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="text"
                maxLength={1}
                value={char}
                onChange={(e) => updateChar(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-16 w-14 rounded-xl bg-white/5 text-center text-2xl font-bold tracking-widest text-white ring-1 ring-white/10 transition-all focus:ring-2 focus:ring-purple-500 uppercase font-mono"
                autoComplete="off"
              />
            ))}
          </div>

          {/* Submit button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-lg bg-purple-600 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-40"
            >
              {confirmMut.isPending ? t("pairing:pairing") : t("pairing:pair")}
            </button>
          </div>

          {/* Success message */}
          {success && (
            <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center text-sm text-green-400">
              {success}
            </div>
          )}

          {/* Error message */}
          {confirmMut.isError && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-400">
              {t("pairing:codeInvalid")}
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
