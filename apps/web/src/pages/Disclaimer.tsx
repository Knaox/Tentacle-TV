import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { i18n } from "@tentacle-tv/shared";

interface DisclaimerProps {
  onAccepted: () => void;
}

const LANGS = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
] as const;

export function Disclaimer({ onAccepted }: DisclaimerProps) {
  const { t } = useTranslation("disclaimer");
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem("tentacle_language");
    return saved?.startsWith("fr") ? "fr" : "en";
  });
  const [checked, setChecked] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const switchLang = useCallback((code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("tentacle_language", code);
    setLang(code);
  }, []);

  // Fade-in on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      containerRef.current?.classList.add("opacity-100");
    });
  }, []);

  const handleAccept = useCallback(() => {
    localStorage.setItem("disclaimer_accepted", "true");
    onAccepted();
  }, [onAccepted]);

  const handleDecline = useCallback(() => {
    setShowDecline(true);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex min-h-screen flex-col items-center justify-center bg-[#080812] px-4 opacity-0 transition-opacity duration-500"
    >
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center">
          <img src="/tentacle-logo-pirate.svg" alt="Tentacle TV" className="h-14 w-14" />
          <p className="mt-2 text-xs tracking-widest text-white/40">Tentacle TV</p>
        </div>

        {/* Language switcher */}
        <div className="mb-6 flex justify-center gap-2">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => switchLang(l.code)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                lang === l.code
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "text-white/30 hover:text-white/50 border border-transparent"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-center text-2xl font-bold text-white">{t("title")}</h1>
        <p className="mt-1 text-center text-sm text-purple-400">{t("heading")}</p>

        {/* Glass body */}
        <div className="mt-6 max-h-64 overflow-y-auto rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
          <p className="whitespace-pre-line text-sm leading-relaxed text-white/60">
            {t("body")}
          </p>
        </div>

        {/* Checkbox */}
        <label className="mt-6 flex cursor-pointer items-center gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => setChecked((v) => !v)}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
              checked
                ? "border-purple-500 bg-purple-500"
                : "border-white/30 bg-transparent"
            }`}
          >
            {checked && (
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className="text-sm text-white/60">{t("checkboxLabel")}</span>
        </label>

        {/* Accept */}
        <button
          type="button"
          onClick={handleAccept}
          disabled={!checked}
          className={`mt-6 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity ${
            checked
              ? "bg-purple-500 hover:bg-purple-600"
              : "bg-purple-500 opacity-40 cursor-not-allowed"
          }`}
        >
          {t("accept")}
        </button>

        {/* Decline */}
        <button
          type="button"
          onClick={handleDecline}
          className="mt-3 w-full rounded-xl border border-white/10 py-2.5 text-xs text-white/40 transition-colors hover:border-white/20 hover:text-white/60"
        >
          {t("decline")}
        </button>

        {/* Decline message */}
        {showDecline && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center">
            <p className="text-sm font-medium text-red-400">{t("declineTitle")}</p>
            <p className="mt-1 text-xs text-red-400/70">{t("declineMessage")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
