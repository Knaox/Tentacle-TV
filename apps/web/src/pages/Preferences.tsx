import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useLibraries, useLibraryPreferences, useSetLibraryPreference, useDeleteLibraryPreference, useSetInterfaceLanguage, useMyPairedDevices, useRevokeMyDevice } from "@tentacle-tv/api-client";
import type { LibraryPreference } from "@tentacle-tv/api-client";

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
    <div className="px-4 pt-6 pb-12 md:px-12">
      <main className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-2xl font-bold text-white">{t("preferences:title")}</h1>
        <p className="mb-8 text-sm text-white/50">
          {t("preferences:subtitle")}
        </p>

        {/* Interface language */}
        <div className="mb-8 rounded-xl border border-white/5 bg-white/5 p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">{t("preferences:interfaceLanguage")}</h3>
          <select
            value={i18n.language}
            onChange={(e) => handleInterfaceLangChange(e.target.value)}
            className="w-full max-w-xs appearance-none rounded-lg border border-white/10 bg-tentacle-surface px-3 py-2 text-sm text-white [&>option]:bg-tentacle-surface [&>option]:text-white"
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
          {libraries?.map((lib: any) => (
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

        {/* Paired devices section */}
        <PairedDevicesSection />
      </main>
    </div>
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
    <div className="rounded-xl border border-white/5 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{libraryName}</h3>
        <div className="flex items-center gap-2">
          {pref && !editing && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              {pref.audioLang && (
                <span className="rounded bg-purple-500/20 px-2 py-0.5 text-purple-300">
                  {t("preferences:audio")}: {languages.find((l) => l.code === pref.audioLang)?.label ?? pref.audioLang}
                </span>
              )}
              {pref.subtitleLang && pref.subtitleMode !== "none" && (
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-blue-300">
                  ST: {languages.find((l) => l.code === pref.subtitleLang)?.label ?? pref.subtitleLang}
                  ({subtitleModes.find((m) => m.value === pref.subtitleMode)?.label})
                </span>
              )}
            </div>
          )}
          <button onClick={() => setEditing(!editing)}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/20">
            {editing ? t("common:cancel") : t("common:edit")}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-white/50">{t("preferences:audio")}</label>
            <select value={audioLang} onChange={(e) => setAudioLang(e.target.value)}
              className="w-full appearance-none rounded-lg border border-white/10 bg-tentacle-surface px-3 py-2 text-sm text-white [&>option]:bg-tentacle-surface [&>option]:text-white">
              <option value="">{t("preferences:default")}</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/50">{t("preferences:subtitles")}</label>
            <select value={subtitleLang} onChange={(e) => setSubtitleLang(e.target.value)}
              className="w-full appearance-none rounded-lg border border-white/10 bg-tentacle-surface px-3 py-2 text-sm text-white [&>option]:bg-tentacle-surface [&>option]:text-white">
              <option value="">{t("preferences:none")}</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/50">{t("preferences:subtitleMode")}</label>
            <select value={subtitleMode} onChange={(e) => setSubtitleMode(e.target.value as any)}
              className="w-full appearance-none rounded-lg border border-white/10 bg-tentacle-surface px-3 py-2 text-sm text-white [&>option]:bg-tentacle-surface [&>option]:text-white">
              {subtitleModes.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 sm:col-span-3">
            <button onClick={handleSave}
              className="rounded-lg bg-tentacle-accent px-4 py-2 text-xs font-semibold text-white hover:bg-tentacle-accent/80">
              {t("common:save")}
            </button>
            {pref && (
              <button onClick={handleReset}
                className="rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-400 hover:bg-red-500/25">
                {t("preferences:reset")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PairedDevicesSection() {
  const { t } = useTranslation("pairing");
  const { data: devices } = useMyPairedDevices();
  const revokeMut = useRevokeMyDevice();

  if (!devices || devices.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-lg font-semibold text-white">
        {t("pairing:pairedDevices")}
      </h2>
      <div className="space-y-3">
        {devices.map((device) => (
          <div
            key={device.id}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4"
          >
            <div>
              <p className="text-sm font-medium text-white">{device.name}</p>
              <p className="mt-1 text-xs text-white/40">
                {t("pairing:lastActive", {
                  date: new Date(device.lastSeen).toLocaleDateString(),
                })}
              </p>
            </div>
            <button
              onClick={() => revokeMut.mutate(device.id)}
              disabled={revokeMut.isPending}
              className="rounded-lg bg-red-600/20 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-40 transition"
            >
              {t("pairing:revoke")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
