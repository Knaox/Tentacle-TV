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
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm transition-colors duration-150 focus-within:ring-2 focus-within:ring-line-focus ${
              value === mode ? "border-[rgba(var(--brand-rgb),0.55)] bg-[var(--brand-soft)] text-content-primary" : "border-line-subtle bg-fill-faint text-content-secondary hover:bg-fill-subtle"
            }`}
          >
            <input type="radio" name={name} value={mode} checked={value === mode} onChange={() => onChange(mode)} className="h-4 w-4 accent-[var(--brand)]" />
            {t(`jellyfinMode_${mode}`)}
          </label>
        ))}
      </div>
    </fieldset>
  );
});
