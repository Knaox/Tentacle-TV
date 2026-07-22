import { useTranslation } from "react-i18next";

/** Délais proposés, en minutes (0 = immédiatement après visionnage). */
export const AUTO_DELETE_DELAYS = [0, 60, 360, 720, 1440] as const;

const DELAY_LABEL_KEYS: Record<number, string> = {
  0: "autoDeleteImmediate",
  60: "autoDeleteDelay1h",
  360: "autoDeleteDelay6h",
  720: "autoDeleteDelay12h",
  1440: "autoDeleteDelay24h",
};

/**
 * Sélecteur du délai d'auto-suppression après visionnage.
 * `value` : null = désactivée, sinon délai en minutes (0 = immédiatement).
 * Deux rendus : dialogue de téléchargement (normal) et ligne de la liste
 * (`compact`).
 */
export function AutoDeleteSelect({
  value,
  onChange,
  compact = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation("downloads");
  return (
    <select
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      aria-label={t("autoDeleteAfterWatch")}
      title={t("autoDeleteAfterWatch")}
      className={
        compact
          ? "max-w-32 rounded-md border border-line-subtle px-1.5 py-1 text-[10px] font-medium text-content-tertiary"
          : "rounded-lg border border-line-subtle px-3 py-2 text-sm text-content-primary"
      }
      style={{ background: "var(--surface-2)" }}
    >
      <option value="">{t("autoDeleteOff")}</option>
      {AUTO_DELETE_DELAYS.map((minutes) => (
        <option key={minutes} value={String(minutes)}>
          {t(DELAY_LABEL_KEYS[minutes])}
        </option>
      ))}
    </select>
  );
}
