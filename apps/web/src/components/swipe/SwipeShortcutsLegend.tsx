import { useTranslation } from "react-i18next";

/** Aide-mémoire des raccourcis — seulement avec un pointeur fin (souris). */
export function SwipeShortcutsLegend() {
  const { t } = useTranslation("swipe");
  const keys: Array<[string, string]> = [
    ["←", t("keyLeft")],
    ["→", t("keyRight")],
    ["↑", t("keyUp")],
    ["↓", t("keyDown")],
    ["Z", t("keyUndo")],
    [t("keySpace"), t("keyInfo")],
  ];
  return (
    <div className="hidden [@media(pointer:fine)]:block">
      <h2 className="sr-only">{t("shortcutsLabel")}</h2>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-content-tertiary">
        {keys.map(([key, label]) => (
          <li key={key} className="inline-flex items-center gap-1.5">
            <kbd className="min-w-[1.6rem] rounded-md border border-line-subtle bg-fill-subtle px-1.5 py-0.5 text-center font-sans text-[0.7rem] font-semibold text-content-secondary">
              {key}
            </kbd>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
