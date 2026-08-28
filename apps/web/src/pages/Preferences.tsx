import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useLibraries, useLibraryPreferences, useSetLibraryPreference, useDeleteLibraryPreference, useSetInterfaceLanguage, useUserId } from "@tentacle-tv/api-client";
import type { LibraryPreference } from "@tentacle-tv/api-client";
import { cacheLibrariesList, cacheLibraryPrefs, readLibrariesList, readLibraryPrefs, type SubtitleMode } from "../offline/localTrackPrefs";
import { clearPendingInterfaceLanguage, markInterfaceLanguagePending, queuePendingPref } from "../offline/pendingPrefs";
import { useOfflineMode } from "../offline/useOfflineMode";
import { PageTransition } from "../components/PageTransition";
import { LibraryPrefCard } from "./preferences/LibraryPrefCard";
import { HdrAutoToggle } from "../components/settings/HdrAutoToggle";
import { LinuxSessionSelect } from "../components/settings/LinuxSessionSelect";
import { PlaybackSettingsSection } from "../components/settings/PlaybackSettingsSection";

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
  // HORS LIGNE : aucune requête (la page vivait en spinner infini) — les
  // caches locaux prennent le relais et les modifications rejoignent une file
  // synchronisée automatiquement au retour en ligne (ConnectivityBinding).
  const offline = useOfflineMode();
  const { data: libraries } = useLibraries({ enabled: !offline });
  const { data: prefs } = useLibraryPreferences({ enabled: !offline });
  const setMut = useSetLibraryPreference();
  const deleteMut = useDeleteLibraryPreference();
  const setLangMut = useSetInterfaceLanguage();

  // Toute lecture réussie alimente le cache hors ligne (y compris après une
  // sauvegarde, l'invalidation refetch) : le lecteur local applique alors les
  // MÊMES préférences sans backend. Les bibliothèques (id + nom) sont cachées
  // pour que cette page reste utilisable hors ligne.
  const userId = useUserId();
  useEffect(() => {
    if (userId && prefs) cacheLibraryPrefs(userId, prefs);
  }, [userId, prefs]);
  useEffect(() => {
    if (userId && libraries) cacheLibrariesList(userId, libraries);
  }, [userId, libraries]);

  // Version du cache : bumpée à chaque édition hors ligne (re-rendu des cartes).
  const [cacheVersion, setCacheVersion] = useState(0);
  const cachedLibraries = useMemo(
    () => (offline && userId ? readLibrariesList(userId) : []),
    [offline, userId],
  );
  const cachedPrefs = useMemo(
    () => (offline && userId ? readLibraryPrefs(userId) : []),
    [offline, userId, cacheVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleInterfaceLangChange = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("tentacle_language", lng);
    if (offline) {
      // Poussée au retour en ligne (flushPendingInterfaceLanguage) ; le pull
      // du démarrage (main.tsx) la respecte — pas d'écrasement.
      markInterfaceLanguagePending(lng);
    } else {
      clearPendingInterfaceLanguage();
      setLangMut.mutate(lng);
    }
    queryClient.invalidateQueries();
  };

  const savePref = (data: { libraryId: string; audioLang?: string | null; subtitleLang?: string | null; subtitleMode?: SubtitleMode }) => {
    if (offline && userId) {
      const entry = {
        libraryId: data.libraryId,
        audioLang: data.audioLang ?? null,
        subtitleLang: data.subtitleLang ?? null,
        subtitleMode: data.subtitleMode ?? ("none" as SubtitleMode),
      };
      // Cache local D'ABORD (la lecture locale applique aussitôt), file ensuite.
      cacheLibraryPrefs(userId, [
        ...readLibraryPrefs(userId).filter((p) => p.libraryId !== entry.libraryId),
        entry,
      ]);
      queuePendingPref(userId, entry);
      setCacheVersion((v) => v + 1);
      return;
    }
    setMut.mutate(data);
  };

  const deletePref = (libraryId: string) => {
    if (offline && userId) {
      cacheLibraryPrefs(userId, readLibraryPrefs(userId).filter((p) => p.libraryId !== libraryId));
      queuePendingPref(userId, { libraryId, audioLang: null, subtitleLang: null, subtitleMode: "none", reset: true });
      setCacheVersion((v) => v + 1);
      return;
    }
    deleteMut.mutate(libraryId);
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

  const displayLibraries: Array<{ Id: string; Name: string }> = offline
    ? cachedLibraries.map((lib) => ({ Id: lib.id, Name: lib.name }))
    : (libraries ?? []);
  const prefsMap = new Map<string, LibraryPreference>(
    offline
      ? cachedPrefs.map((p) => [p.libraryId, {
          id: p.libraryId, jellyfinUserId: userId ?? "", libraryId: p.libraryId,
          audioLang: p.audioLang, subtitleLang: p.subtitleLang, subtitleMode: p.subtitleMode,
        }])
      : (prefs ?? []).map((p) => [p.libraryId, p]),
  );

  return (
    <PageTransition>
      <div className="max-w-2xl">
        {/* Le titre et le sous-titre sont portes par SettingsShell. */}

        {offline && (
          <div className="mb-4 rounded-lg bg-status-warning-bg px-3 py-2 text-xs font-medium text-status-warning-fg">
            {t("preferences:offlineSavedLocally")}
          </div>
        )}

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

        {/* Ce que le lecteur fait tout seul : les passages d'un épisode, et sa
            fin. Réglages de COMPTE — la section porte ses propres cartes. */}
        <PlaybackSettingsSection />

        {/* Bascule HDR de l'écran — ne se rend que sur un bureau Windows doté
            du lecteur natif, le composant s'efface ailleurs. */}
        <div className="mb-8 rounded-xl border border-line-subtle bg-fill-subtle p-5 empty:hidden">
          <HdrAutoToggle />
        </div>

        {/* Choix de session graphique — coquille Linux seulement, même geste
            d'effacement que la bascule HDR. Relance proposée, jamais imposée. */}
        <div className="mb-8 rounded-xl border border-line-subtle bg-fill-subtle p-5 empty:hidden">
          <LinuxSessionSelect />
        </div>

        {!offline && !libraries && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
          </div>
        )}
        {offline && displayLibraries.length === 0 && (
          <p className="py-10 text-center text-sm text-content-quaternary">{t("preferences:offlineNoCacheHint")}</p>
        )}

        <div className="space-y-4">
          {displayLibraries.map((lib) => (
            <LibraryPrefCard
              key={lib.Id}
              libraryId={lib.Id}
              libraryName={lib.Name}
              pref={prefsMap.get(lib.Id) ?? null}
              languages={LANGUAGES}
              subtitleModes={SUBTITLE_MODES}
              t={t}
              onSave={savePref}
              onDelete={() => deletePref(lib.Id)}
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
