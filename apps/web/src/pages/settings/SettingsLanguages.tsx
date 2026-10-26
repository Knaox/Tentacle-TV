import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLibraries, useLibraryPreferences, useSetLibraryPreference, useDeleteLibraryPreference, useUserId } from "@tentacle-tv/api-client";
import type { LibraryPreference } from "@tentacle-tv/api-client";
import { cacheLibrariesList, cacheLibraryPrefs, readLibrariesList, readLibraryPrefs, type SubtitleMode } from "../../offline/localTrackPrefs";
import { queuePendingPref } from "../../offline/pendingPrefs";
import { useOfflineMode } from "../../offline/useOfflineMode";
import { PageTransition } from "../../components/PageTransition";
import { LibraryPrefCard } from "../preferences/LibraryPrefCard";
import { INTERFACE_LANGUAGES, LANGUAGE_CODES, LANGUAGE_KEYS } from "../preferences/languageOptions";
import { SETTING_FIELD } from "../../components/settings/SettingToggleRow";
import { SettingItem } from "../../components/settings/wide/SettingItem";
import { WideGroup } from "../../components/settings/wide/WideGroup";
import { useInterfaceLanguage } from "../../components/settings/useInterfaceLanguage";

/**
 * Réglages › Langues et sous-titres — ce qu'on cherche quand « le film ne se
 * lance pas en VF » : la langue audio et les sous-titres choisis d'office pour
 * CHAQUE bibliothèque, puis la langue des menus. Les deux étaient enfouis en
 * tête de « Lecture », au-dessus des sauts de génériques ; personne ne les y
 * trouvait.
 *
 * HORS LIGNE : aucune requête — les caches locaux prennent le relais et les
 * modifications rejoignent une file synchronisée automatiquement au retour en
 * ligne (ConnectivityBinding).
 */
export function SettingsLanguages() {
  const { t, i18n } = useTranslation("preferences");
  const offline = useOfflineMode();
  const { data: libraries } = useLibraries({ enabled: !offline });
  const { data: prefs } = useLibraryPreferences({ enabled: !offline });
  const setMut = useSetLibraryPreference();
  const deleteMut = useDeleteLibraryPreference();
  // La langue des menus : le geste unique de toutes les pages qui l'offrent (Octave compris).
  const { setLanguage: setInterfaceLanguage } = useInterfaceLanguage();

  // Toute lecture réussie alimente le cache hors ligne (y compris après une
  // sauvegarde, l'invalidation refetch) : le lecteur local applique alors les
  // MÊMES préférences sans backend.
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

  const languages = useMemo(() => LANGUAGE_CODES.map((code) => ({ code, label: t(LANGUAGE_KEYS[code]) })), [t]);
  const subtitleModes = useMemo(() => [
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
        {offline && (
          <div className="mb-4 rounded-lg bg-status-warning-bg px-3 py-2 text-xs font-medium text-status-warning-fg">
            {t("preferences:offlineSavedLocally")}
          </div>
        )}

        <WideGroup section="languages" group="tracks">
          <SettingItem setting="libraryTracks">
            {!offline && !libraries && (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
              </div>
            )}
            {offline && displayLibraries.length === 0 && (
              <p className="py-4 text-center text-sm text-content-quaternary">{t("preferences:offlineNoCacheHint")}</p>
            )}
            <div className="space-y-3">
              {displayLibraries.map((lib) => (
                <LibraryPrefCard
                  key={lib.Id}
                  libraryId={lib.Id}
                  libraryName={lib.Name}
                  pref={prefsMap.get(lib.Id) ?? null}
                  languages={languages}
                  subtitleModes={subtitleModes}
                  t={t}
                  onSave={savePref}
                  onDelete={() => deletePref(lib.Id)}
                />
              ))}
            </div>
          </SettingItem>
        </WideGroup>

        <WideGroup section="languages" group="interface">
          <SettingItem
            setting="interfaceLanguage"
            trailing={(
              <select
                value={i18n.language}
                onChange={(e) => setInterfaceLanguage(e.target.value)}
                aria-label={t("preferences:interfaceLanguage")}
                className={`w-40 ${SETTING_FIELD}`}
              >
                {INTERFACE_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.label}</option>
                ))}
              </select>
            )}
          />
        </WideGroup>
      </div>
    </PageTransition>
  );
}
