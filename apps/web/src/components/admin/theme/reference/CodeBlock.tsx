import { useState } from "react";
import { useTranslation } from "react-i18next";

interface CodeBlockProps {
  /** Title shown above the block. */
  title: string;
  /** Optional description. */
  description?: string;
  /** The code itself — pre-formatted, copied verbatim on click. */
  code: string;
  /** Display language hint (informational only, no syntax highlighting). */
  language?: string;
}

/**
 * Mono-spaced, syntax-pre code block with a "Copy" button that grabs the
 * full content. Designed for the theme-reference page so admins can copy
 * blocks to a chatbot for AI theme generation.
 */
export function CodeBlock({
  title,
  description,
  code,
  language = "css",
}: CodeBlockProps) {
  const { t } = useTranslation("adminTheme");
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard API blocked — fail silently, the user can select manually */
    }
  };

  const lineCount = code.split("\n").length;
  const charCount = code.length;

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <header className="flex flex-col gap-2 border-b border-white/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-white/55">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">
            {language} · {lineCount} {t("refLines")} · {charCount} {t("refChars")}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all ${
              copied
                ? "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]"
                : "bg-[var(--brand-soft)] text-[var(--brand-light)] hover:bg-[rgba(var(--brand-rgb),0.25)]"
            }`}
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {t("refCopied")}
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.83a2 2 0 00-.59-1.42l-2.82-2.82A2 2 0 0011.17 2H8z" />
                  <path d="M6 6a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2v-1h-1.5v1a.5.5 0 01-.5.5H6a.5.5 0 01-.5-.5V8a.5.5 0 01.5-.5h1V6H6z" />
                </svg>
                {t("refCopy")}
              </>
            )}
          </button>
        </div>
      </header>
      <pre className="max-h-[480px] overflow-auto bg-black/40 p-4 text-xs leading-relaxed text-white/85">
        <code className="font-mono">{code}</code>
      </pre>
    </section>
  );
}
