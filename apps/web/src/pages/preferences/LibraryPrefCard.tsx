import { useEffect, useState } from "react";
import type { LibraryPreference } from "@tentacle-tv/api-client";

/**
 * Carte de préférences de langues d'UNE bibliothèque (extraction de
 * Preferences.tsx — limite 300 lignes par fichier). Identique en ligne et
 * hors ligne : la persistance (PUT backend ou cache local + file d'attente)
 * est entièrement portée par les callbacks du parent.
 */
export function LibraryPrefCard({ libraryId, libraryName, pref, languages, subtitleModes, t, onSave, onDelete }: {
  libraryId: string;
  libraryName: string;
  pref: LibraryPreference | null;
  languages: { code: string; label: string }[];
  subtitleModes: { value: string; label: string }[];
  t: (key: string) => string;
  onSave: (data: { libraryId: string; audioLang?: string | null; subtitleLang?: string | null; subtitleMode?: "none" | "always" | "forced" | "signs" }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [audioLang, setAudioLang] = useState(pref?.audioLang ?? "");
  const [subtitleLang, setSubtitleLang] = useState(pref?.subtitleLang ?? "");
  const [subtitleMode, setSubtitleMode] = useState<"none" | "always" | "forced" | "signs">(pref?.subtitleMode ?? "none");

  // Sync state when pref loads/changes (e.g. after query completes)
  useEffect(() => {
    if (!editing) {
      setAudioLang(pref?.audioLang ?? "");
      setSubtitleLang(pref?.subtitleLang ?? "");
      setSubtitleMode(pref?.subtitleMode ?? "none");
    }
  }, [pref]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    onSave({
      libraryId,
      audioLang: audioLang || null,
      subtitleLang: subtitleLang || null,
      subtitleMode,
    });
    setEditing(false);
  };

  const handleReset = () => {
    onDelete();
    setAudioLang("");
    setSubtitleLang("");
    setSubtitleMode("none");
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-line-subtle bg-fill-subtle p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-content-primary">{libraryName}</h3>
        <div className="flex items-center gap-2">
          {pref && !editing && (
            <div className="flex items-center gap-2 text-xs text-content-tertiary">
              {pref.audioLang && (
                <span className="rounded bg-[rgba(var(--brand-rgb),0.2)] px-2 py-0.5 text-[var(--brand-light)]">
                  {t("preferences:audio")}: {languages.find((l) => l.code === pref.audioLang)?.label ?? pref.audioLang}
                </span>
              )}
              {pref.subtitleLang && pref.subtitleMode !== "none" && (
                <span className="rounded bg-status-info-bg px-2 py-0.5 text-status-info-fg">
                  ST: {languages.find((l) => l.code === pref.subtitleLang)?.label ?? pref.subtitleLang}
                  ({subtitleModes.find((m) => m.value === pref.subtitleMode)?.label})
                </span>
              )}
            </div>
          )}
          <button onClick={() => setEditing(!editing)}
            className="rounded-lg bg-fill-soft px-3 py-1.5 text-xs text-content-secondary hover:bg-fill-medium">
            {editing ? t("common:cancel") : t("common:edit")}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-content-tertiary">{t("preferences:audio")}</label>
            <select value={audioLang} onChange={(e) => setAudioLang(e.target.value)}
              className="w-full appearance-none rounded-lg border border-line-subtle bg-tentacle-surface px-3 py-2 text-sm text-content-primary [&>option]:bg-tentacle-surface [&>option]:text-content-primary">
              <option value="">{t("preferences:default")}</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-content-tertiary">{t("preferences:subtitles")}</label>
            <select value={subtitleLang} onChange={(e) => setSubtitleLang(e.target.value)}
              className="w-full appearance-none rounded-lg border border-line-subtle bg-tentacle-surface px-3 py-2 text-sm text-content-primary [&>option]:bg-tentacle-surface [&>option]:text-content-primary">
              <option value="">{t("preferences:none")}</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-content-tertiary">{t("preferences:subtitleMode")}</label>
            <select value={subtitleMode} onChange={(e) => setSubtitleMode(e.target.value as "none" | "always" | "forced" | "signs")}
              className="w-full appearance-none rounded-lg border border-line-subtle bg-tentacle-surface px-3 py-2 text-sm text-content-primary [&>option]:bg-tentacle-surface [&>option]:text-content-primary">
              {subtitleModes.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 sm:col-span-3">
            <button onClick={handleSave}
              className="rounded-lg h-11 px-5 bg-cta-primary-bg text-cta-primary-fg text-xs font-bold hover:bg-cta-primary-bg-hover">
              {t("common:save")}
            </button>
            {pref && (
              <button onClick={handleReset}
                className="rounded-lg bg-danger-surface px-4 py-2 text-xs text-status-error-fg hover:bg-danger-surface-hover">
                {t("preferences:reset")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
