import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import type { PairStatus } from "./usePairFlow";
import { parsePastedCode, sanitizeCodeChar } from "./pairCode";

export interface PairCodeInputsHandle {
  focusFirst: () => void;
}

/**
 * `PairCodeInputs` de l'app : 4 cases de 60 × 72, rayon 12, écart 12, marge
 * basse 20 ; chiffre 28 extra-gras. Vide = `fill.subtle` + filet 1 ; saisie =
 * `brand.soft` + filet violet 2 ; erreur = surface danger + filet rouge 2.
 * En plus de l'app : coller un code complet remplit les quatre cases.
 */
export const PairCodeInputs = forwardRef<PairCodeInputsHandle, {
  chars: string[];
  onChange: (next: string[]) => void;
  status: PairStatus;
}>(function PairCodeInputs({ chars, onChange, status }, ref) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useImperativeHandle(ref, () => ({ focusFirst: () => refs.current[0]?.focus() }));

  const handleChange = useCallback((i: number, value: string) => {
    const char = sanitizeCodeChar(value);
    const next = [...chars];
    next[i] = char;
    onChange(next);
    if (char && i < 3) refs.current[i + 1]?.focus();
  }, [chars, onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const code = parsePastedCode(e.clipboardData.getData("text"));
    if (!code) return;
    e.preventDefault();
    onChange(code);
    refs.current[3]?.focus();
  }, [onChange]);

  return (
    <div className="flex justify-center" style={{ gap: 12, marginBottom: 20 }}>
      {chars.map((char, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={char}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !chars[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={handlePaste}
          maxLength={2}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          disabled={status === "pairing"}
          autoFocus={i === 0}
          aria-label={`Code digit ${i + 1}`}
          className="text-center font-extrabold text-content-primary outline-none"
          style={{
            width: 60,
            height: 72,
            borderRadius: 12,
            fontSize: 28,
            ...(status === "error"
              ? { background: "var(--danger-surface)", border: "2px solid var(--status-error)" }
              : char
                ? { background: "var(--brand-soft)", border: "2px solid var(--brand)" }
                : { background: "var(--fill-subtle)", border: "1px solid var(--border-subtle)" }),
          }}
        />
      ))}
    </div>
  );
});
