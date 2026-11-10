import { memo, useId } from "react";
import { useTranslation } from "react-i18next";

export type JellyfinMode = "none" | "domain" | "path";
const MODES: readonly JellyfinMode[] = ["none", "domain", "path"];

/** Jellyfin depuis Internet : pas du tout, sur son domaine, ou sous un chemin du domaine de Tentacle. De vrais boutons radio. */
export const JellyfinModeChoice = memo(function JellyfinModeChoice({ value, onChange }: { value: JellyfinMode; onChange: (mode: JellyfinMode) => void }) {
  const { t } = useTranslation("remoteAccess");
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-content-secondary">{t("jellyfinMode")}</legend>
      <div className="flex flex-wrap gap-2">
        {MODES.map((mode) => (
          <label
            key={mode}
            className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-field px-3 text-sm transition-colors duration-hover focus-within:ring-2 focus-within:ring-line-focus ${
              value === mode ? "bg-accent-soft text-content-primary shadow-[inset_0_0_0_1.5px_var(--accent)]" : "bg-surface-2 text-content-secondary hover:bg-surface-3"
            }`}
          >
            <input type="radio" name={name} value={mode} checked={value === mode} onChange={() => onChange(mode)} className="h-4 w-4 accent-[var(--accent)]" />
            {t(`jellyfinMode_${mode}`)}
          </label>
        ))}
      </div>
    </fieldset>
  );
});
