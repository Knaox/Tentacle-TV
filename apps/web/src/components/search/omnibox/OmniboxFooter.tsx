/**
 * Le pied de l'omnibox : ses raccourcis, dits une fois pour toutes — et le
 * temps qu'a mis le moteur, à la manière de Google (« Trouvé en 2 ms ») :
 * c'est lui qui rend la vitesse visible.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { isAppleKeyboard } from "../../../lib/shortcutLabel";

function Hint({ keys, label }: { keys: readonly string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex gap-0.5">
        {keys.map((key) => (
          <kbd key={key} className="min-w-[18px] rounded border border-line-subtle bg-fill-subtle px-1 text-center text-[10px] leading-[16px] text-content-tertiary">
            {key}
          </kbd>
        ))}
      </span>
      {label}
    </span>
  );
}

export const OmniboxFooter = memo(function OmniboxFooter({ tookMs, hasQuery, canComplete }: {
  tookMs: number | undefined;
  hasQuery: boolean;
  /** Une complétion est proposée : ⇥ l'accepte. */
  canComplete: boolean;
}) {
  const { t } = useTranslation("search");
  // ⌘ sur Mac, Ctrl ailleurs — même règle que le rappel de la barre.
  const mod = isAppleKeyboard() ? "⌘" : "Ctrl";
  return (
    <div className="flex h-10 shrink-0 items-center gap-4 border-t border-line-subtle px-4 text-[11px] text-content-quaternary">
      <Hint keys={["↑", "↓"]} label={t("hintNavigate")} />
      <Hint keys={["↵"]} label={t("hintOpen")} />
      {canComplete && <Hint keys={["⇥"]} label={t("hintComplete")} />}
      {hasQuery && <Hint keys={[mod, "↵"]} label={t("hintAllResults")} />}
      <span className="ml-auto tabular-nums">{tookMs !== undefined ? t("foundIn", { ms: Math.max(1, tookMs) }) : ""}</span>
    </div>
  );
});
