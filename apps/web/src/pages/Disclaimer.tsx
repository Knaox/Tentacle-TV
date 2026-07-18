import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { i18n } from "@tentacle-tv/shared";
import { TentacleLogo } from "../components/ui/TentacleLogo";

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
      // Suit le schéma : un écran plein cadre figé en indigo sombre aurait été
      // incohérent en thème clair, où toute l'app est nacrée.
      className="flex min-h-screen flex-col items-center justify-center bg-surface-0 px-4 opacity-0 transition-opacity duration-500"
    >
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center">
          <TentacleLogo size="lg" variant="glow" />
          <p className="mt-3 text-xs tracking-[0.18em] text-content-quaternary">TENTACLE TV</p>
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
                  ? "bg-[rgba(var(--brand-rgb),0.2)] text-[var(--brand)] border border-[rgba(var(--brand-rgb),0.3)]"
                  : "text-content-quaternary hover:text-content-tertiary border border-transparent"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-center text-2xl font-bold text-content-primary">{t("title")}</h1>
        <p className="mt-1 text-center text-sm text-[var(--brand)]">{t("heading")}</p>

        {/* Glass body */}
        <div className="mt-6 max-h-64 overflow-y-auto rounded-2xl border border-line-subtle bg-fill-faint p-5">
          <p className="whitespace-pre-line text-sm leading-relaxed text-content-tertiary">
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
                ? "border-[var(--brand)]/45 bg-[var(--brand-soft)]"
                : "border-line-strong bg-transparent"
            }`}
          >
            {checked && (
              <svg className="h-4 w-4 text-[var(--brand-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className="text-sm text-content-tertiary">{t("checkboxLabel")}</span>
        </label>

        {/* Accept */}
        <button
          type="button"
          onClick={handleAccept}
          disabled={!checked}
          className={`mt-6 w-full rounded-xl h-11 text-sm font-bold transition-opacity bg-cta-primary-bg text-cta-primary-fg hover:bg-cta-primary-bg-hover ${
            checked ? "" : "opacity-40 cursor-not-allowed"
          }`}

        >
          {t("accept")}
        </button>

        {/* Decline */}
        <button
          type="button"
          onClick={handleDecline}
          className="mt-3 w-full rounded-xl border border-line-subtle py-2.5 text-xs text-content-quaternary transition-colors hover:border-line-strong hover:text-content-tertiary"
        >
          {t("decline")}
        </button>

        {/* Decline message */}
        {showDecline && (
          <div className="mt-4 rounded-xl border border-danger-border bg-danger-surface p-4 text-center">
            <p className="text-sm font-medium text-status-error-fg">{t("declineTitle")}</p>
            <p className="mt-1 text-xs text-status-error-fg">{t("declineMessage")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
