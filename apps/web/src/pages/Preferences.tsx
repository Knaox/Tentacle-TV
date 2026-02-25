import { useState, useEffect } from "react";
import { useLibraries, useLibraryPreferences, useSetLibraryPreference, useDeleteLibraryPreference } from "@tentacle/api-client";
import type { LibraryPreference } from "@tentacle/api-client";

const LANGUAGES = [
  { code: "fre", label: "Français" },
  { code: "eng", label: "English" },
  { code: "jpn", label: "Japonais" },
  { code: "ger", label: "Allemand" },
  { code: "spa", label: "Espagnol" },
  { code: "ita", label: "Italien" },
  { code: "por", label: "Portugais" },
  { code: "rus", label: "Russe" },
  { code: "kor", label: "Coréen" },
  { code: "chi", label: "Chinois" },
  { code: "ara", label: "Arabe" },
  { code: "pol", label: "Polonais" },
  { code: "dut", label: "Néerlandais" },
  { code: "cze", label: "Tchèque" },
  { code: "hin", label: "Hindi" },
  { code: "tha", label: "Thaï" },
  { code: "swe", label: "Suédois" },
  { code: "nor", label: "Norvégien" },
  { code: "fin", label: "Finnois" },
  { code: "tur", label: "Turc" },
  { code: "hun", label: "Hongrois" },
  { code: "rum", label: "Roumain" },
  { code: "gre", label: "Grec" },
  { code: "dan", label: "Danois" },
  { code: "heb", label: "Hébreu" },
  { code: "vie", label: "Vietnamien" },
  { code: "ind", label: "Indonésien" },
  { code: "may", label: "Malais" },
  { code: "ukr", label: "Ukrainien" },
  { code: "bul", label: "Bulgare" },
  { code: "hrv", label: "Croate" },
  { code: "srp", label: "Serbe" },
  { code: "cat", label: "Catalan" },
  { code: "tam", label: "Tamoul" },
  { code: "tel", label: "Télougou" },
  { code: "per", label: "Persan" },
];

const SUBTITLE_MODES = [
  { value: "none", label: "Désactivés" },
  { value: "always", label: "Toujours affichés" },
  { value: "forced", label: "Forcés uniquement" },
  { value: "signs", label: "Signs & Songs" },
] as const;

export function Preferences() {
  const { data: libraries } = useLibraries();
  const { data: prefs } = useLibraryPreferences();
  const setMut = useSetLibraryPreference();
  const deleteMut = useDeleteLibraryPreference();

  const prefsMap = new Map(prefs?.map((p) => [p.libraryId, p]) ?? []);

  return (
    <div className="px-4 pt-6 pb-12 md:px-12">
      <main className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Préférences de langues</h1>
        <p className="mb-8 text-sm text-white/50">
          Configurez les pistes audio et sous-titres par défaut pour chaque bibliothèque.
        </p>

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
              onSave={(data) => setMut.mutate(data)}
              onDelete={() => deleteMut.mutate(lib.Id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function LibraryPrefCard({ libraryId, libraryName, pref, onSave, onDelete }: {
  libraryId: string;
  libraryName: string;
  pref: LibraryPreference | null;
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
                  Audio: {LANGUAGES.find((l) => l.code === pref.audioLang)?.label ?? pref.audioLang}
                </span>
              )}
              {pref.subtitleLang && pref.subtitleMode !== "none" && (
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-blue-300">
                  ST: {LANGUAGES.find((l) => l.code === pref.subtitleLang)?.label ?? pref.subtitleLang}
                  ({SUBTITLE_MODES.find((m) => m.value === pref.subtitleMode)?.label})
                </span>
              )}
            </div>
          )}
          <button onClick={() => setEditing(!editing)}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/20">
            {editing ? "Annuler" : "Modifier"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-white/50">Audio</label>
            <select value={audioLang} onChange={(e) => setAudioLang(e.target.value)}
              className="w-full appearance-none rounded-lg border border-white/10 bg-tentacle-surface px-3 py-2 text-sm text-white [&>option]:bg-tentacle-surface [&>option]:text-white">
              <option value="">Par défaut</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/50">Sous-titres</label>
            <select value={subtitleLang} onChange={(e) => setSubtitleLang(e.target.value)}
              className="w-full appearance-none rounded-lg border border-white/10 bg-tentacle-surface px-3 py-2 text-sm text-white [&>option]:bg-tentacle-surface [&>option]:text-white">
              <option value="">Aucun</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/50">Mode sous-titres</label>
            <select value={subtitleMode} onChange={(e) => setSubtitleMode(e.target.value as any)}
              className="w-full appearance-none rounded-lg border border-white/10 bg-tentacle-surface px-3 py-2 text-sm text-white [&>option]:bg-tentacle-surface [&>option]:text-white">
              {SUBTITLE_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 sm:col-span-3">
            <button onClick={handleSave}
              className="rounded-lg bg-tentacle-accent px-4 py-2 text-xs font-semibold text-white hover:bg-tentacle-accent/80">
              Enregistrer
            </button>
            {pref && (
              <button onClick={handleReset}
                className="rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-400 hover:bg-red-500/25">
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
