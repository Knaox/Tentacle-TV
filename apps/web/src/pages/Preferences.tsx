import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useLibraries, useLibraryPreferences, useSetLibraryPreference, useDeleteLibraryPreference, useSetInterfaceLanguage, useUserId } from "@tentacle-tv/api-client";
import { cacheLibraryPrefs } from "../offline/localTrackPrefs";
import type { LibraryPreference } from "@tentacle-tv/api-client";
import { PageTransition } from "../components/PageTransition";

const LANGUAGE_CODES = [
  "fre", "fre-vff", "fre-vfq", "eng", "jpn", "ger", "spa", "ita", "por", "rus", "kor", "chi",
  "ara", "pol", "dut", "cze", "hin", "tha", "swe", "nor", "fin", "tur",
  "hun", "rum", "gre", "dan", "heb", "vie", "ind", "may", "ukr", "bul",
  "hrv", "srp", "cat", "tam", "tel", "per",
] as const;

const LANGUAGE_KEYS: Record<string, string> = {
  fre: "preferences:langFr",
  "fre-vff": "preferences:langFrVff",
  "fre-vfq": "preferences:langFrVfq",
  eng: "preferences:langEn",
  jpn: "preferences:langJa",
  ger: "preferences:langDe",
  spa: "preferences:langEs",
  ita: "preferences:langIt",
  por: "preferences:langPt",
  rus: "preferences:langRu",
  kor: "preferences:langKo",
  chi: "preferences:langZh",
  ara: "preferences:langAr",
  pol: "preferences:langPl",
  dut: "preferences:langNl",
  cze: "preferences:langCs",
  hin: "preferences:langHi",
  tha: "preferences:langTh",
  swe: "preferences:langSv",
  nor: "preferences:langNo",
  fin: "preferences:langFi",
  tur: "preferences:langTr",
  hun: "preferences:langHu",
  rum: "preferences:langRo",
  gre: "preferences:langEl",
  dan: "preferences:langDa",
  heb: "preferences:langHe",
  vie: "preferences:langVi",
  ind: "preferences:langId",
  may: "preferences:langMs",
  ukr: "preferences:langUk",
  bul: "preferences:langBg",
  hrv: "preferences:langHr",
  srp: "preferences:langSr",
  cat: "preferences:langCa",
  tam: "preferences:langTa",
  tel: "preferences:langTe",
  per: "preferences:langFa",
};

const INTERFACE_LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
] as const;

export function Preferences() {
  const { t, i18n } = useTranslation("preferences");
  const queryClient = useQueryClient();
  const { data: libraries } = useLibraries();
  const { data: prefs } = useLibraryPreferences();
  const setMut = useSetLibraryPreference();
  const deleteMut = useDeleteLibraryPreference();
  const setLangMut = useSetInterfaceLanguage();

  // Toute lecture réussie alimente le cache hors ligne (y compris après une
  // sauvegarde, l'invalidation refetch) : le lecteur local applique alors les
  // MÊMES préférences sans backend.
  const userId = useUserId();
  useEffect(() => {
    if (userId && prefs) cacheLibraryPrefs(userId, prefs);
  }, [userId, prefs]);

  const handleInterfaceLangChange = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("tentacle_language", lng);
    setLangMut.mutate(lng);
    queryClient.invalidateQueries();
  };

  const LANGUAGES = useMemo(() =>
    LANGUAGE_CODES.map((code) => ({
      code,
      label: t(LANGUAGE_KEYS[code]),
    })),
    [t]
  );

  const SUBTITLE_MODES = useMemo(() => [
    { value: "none" as const, label: t("preferences:modeDisabled") },
    { value: "always" as const, label: t("preferences:modeAlwaysOn") },
    { value: "forced" as const, label: t("preferences:modeForcedOnly") },
    { value: "signs" as const, label: t("preferences:modeSignsSongs") },
  ], [t]);

  const prefsMap = new Map(prefs?.map((p) => [p.libraryId, p]) ?? []);

  return (
    <PageTransition>
      <div className="max-w-2xl">
        {/* Le titre et le sous-titre sont portes par SettingsShell. */}

        {/* Interface language */}
        <div className="mb-8 rounded-xl border border-line-subtle bg-fill-subtle p-5">
          <h3 className="mb-3 text-sm font-semibold text-content-primary">{t("preferences:interfaceLanguage")}</h3>
          <select
            value={i18n.language}
            onChange={(e) => handleInterfaceLangChange(e.target.value)}
            className="w-full max-w-xs appearance-none rounded-lg border border-line-subtle bg-tentacle-surface px-3 py-2 text-sm text-content-primary [&>option]:bg-tentacle-surface [&>option]:text-content-primary"
          >
            {INTERFACE_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </div>

        {!libraries && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
          </div>
        )}

        <div className="space-y-4">
          {libraries?.map((lib: { Id: string; Name: string }) => (
            <LibraryPrefCard
              key={lib.Id}
              libraryId={lib.Id}
              libraryName={lib.Name}
              pref={prefsMap.get(lib.Id) ?? null}
              languages={LANGUAGES}
              subtitleModes={SUBTITLE_MODES}
              t={t}
              onSave={(data) => setMut.mutate(data)}
              onDelete={() => deleteMut.mutate(lib.Id)}
            />
          ))}
        </div>

        {/* Mot de passe, appareils jumeles et changement de serveur ont ete
            regroupes dans Reglages > Securite : ils etaient enterres ici, sous
            une carte PAR bibliotheque. */}
      </div>
    </PageTransition>
  );
}

function LibraryPrefCard({ libraryId, libraryName, pref, languages, subtitleModes, t, onSave, onDelete }: {
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
            <select value={subtitleMode} onChange={(e) => setSubtitleMode(e.target.value as any)}
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

