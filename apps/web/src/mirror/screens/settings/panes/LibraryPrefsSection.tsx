import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Folder, Info, WifiOff } from "lucide-react";
import {
  useDeleteLibraryPreference, useLibraries, useLibraryPreferences, useSetLibraryPreference, useUserId,
  type LibraryPreference,
} from "@tentacle-tv/api-client";
import {
  cacheLibrariesList, cacheLibraryPrefs, readLibrariesList, readLibraryPrefs,
} from "../../../../offline/localTrackPrefs";
import { queuePendingPref } from "../../../../offline/pendingPrefs";
import { useOfflineMode } from "../../../../offline/useOfflineMode";
import { LibraryPrefCard } from "../../../../pages/preferences/LibraryPrefCard";
import { ActionSheet } from "../../../ui/ActionSheet";
import { SettingsRow } from "../ui/SettingsRow";
import { SettingsSection } from "../ui/SettingsSection";
import { PREF_LANGUAGE_KEYS, PREF_SUBTITLE_MODE_KEYS, summarizeLibraryPref, type SubtitleMode } from "./libraryPrefSummary";

type SavePayload = { libraryId: string; audioLang?: string | null; subtitleLang?: string | null; subtitleMode?: SubtitleMode };

/**
 * `MediaPreferencesSection` de l'app : une LIGNE par bibliothèque qui résume
 * son choix ; la feuille l'édite. L'édition réutilise la carte du web
 * (`LibraryPrefCard`) et la même persistance que `pages/Preferences.tsx` :
 * en ligne, le serveur (et le cache local qui sert le lecteur hors ligne) ;
 * hors ligne, le cache local puis la file poussée au retour.
 */
export function LibraryPrefsSection() {
  const { t } = useTranslation("preferences");
  const offline = useOfflineMode();
  const userId = useUserId();
  const { data: libraries } = useLibraries({ enabled: !offline });
  const { data: prefs } = useLibraryPreferences({ enabled: !offline });
  const setMut = useSetLibraryPreference();
  const deleteMut = useDeleteLibraryPreference();
  const [nonce, setNonce] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  // Toute lecture réussie alimente le cache hors ligne, comme la page Lecture du web.
  useEffect(() => { if (userId && prefs) cacheLibraryPrefs(userId, prefs); }, [userId, prefs]);
  useEffect(() => { if (userId && libraries) cacheLibrariesList(userId, libraries); }, [userId, libraries]);

  const local = useMemo(() => {
    if (!offline || !userId) return null;
    return { libraries: readLibrariesList(userId), prefs: readLibraryPrefs(userId) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `nonce` : relecture après écriture
  }, [offline, userId, nonce]);

  const rows = local
    ? local.libraries.map((lib) => ({ id: lib.id, name: lib.name }))
    : (libraries ?? []).map((lib) => ({ id: lib.Id, name: lib.Name }));
  const prefsMap = useMemo(() => {
    const list: LibraryPreference[] = local
      ? local.prefs.map((p) => ({ ...p, id: p.libraryId, jellyfinUserId: userId ?? "" }))
      : (prefs ?? []);
    return new Map(list.map((p) => [p.libraryId, p]));
  }, [local, prefs, userId]);

  const languages = useMemo(
    () => Object.entries(PREF_LANGUAGE_KEYS).map(([code, key]) => ({ code, label: t(key) })),
    [t],
  );
  const subtitleModes = useMemo(
    () => (Object.keys(PREF_SUBTITLE_MODE_KEYS) as SubtitleMode[]).map((value) => ({ value, label: t(PREF_SUBTITLE_MODE_KEYS[value]) })),
    [t],
  );

  const writeLocal = useCallback((entry: { libraryId: string; audioLang: string | null; subtitleLang: string | null; subtitleMode: SubtitleMode }, reset: boolean) => {
    if (!userId) return;
    const others = readLibraryPrefs(userId).filter((p) => p.libraryId !== entry.libraryId);
    cacheLibraryPrefs(userId, reset ? others : [...others, entry]);
    queuePendingPref(userId, reset ? { ...entry, reset: true } : entry);
    setNonce((n) => n + 1);
  }, [userId]);

  const save = (data: SavePayload) => {
    setOpenId(null);
    if (local) {
      writeLocal({ libraryId: data.libraryId, audioLang: data.audioLang ?? null, subtitleLang: data.subtitleLang ?? null, subtitleMode: data.subtitleMode ?? "none" }, false);
      return;
    }
    setMut.mutate(data);
  };
  const remove = (libraryId: string) => {
    setOpenId(null);
    if (local) {
      writeLocal({ libraryId, audioLang: null, subtitleLang: null, subtitleMode: "none" }, true);
      return;
    }
    deleteMut.mutate(libraryId);
  };

  if (!local && rows.length === 0) return null;
  const open = rows.find((row) => row.id === openId) ?? null;

  return (
    <>
      {local && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-[var(--status-warning-bg)] p-3 text-[13px] leading-[18px] text-[var(--status-warning-fg)]">
          <WifiOff size={14} aria-hidden />
          <span className="flex-1">{t("offlineSavedLocally")}</span>
        </div>
      )}
      <SettingsSection title={t("title")} caption={t("subtitle")}>
        {rows.length === 0 && <SettingsRow icon={Info} label={t("offlineNoCacheHint")} last />}
        {rows.map((lib, index) => (
          <SettingsRow
            key={lib.id}
            icon={Folder}
            label={lib.name}
            description={summarizeLibraryPref(prefsMap.get(lib.id) ?? null, t) ?? t("default")}
            chevron
            last={index === rows.length - 1}
            onPress={() => setOpenId(lib.id)}
          />
        ))}
      </SettingsSection>
      <ActionSheet open={open !== null} onClose={() => setOpenId(null)} label={open?.name}>
        {open ? (
          <div className="px-4 pb-6">
            <LibraryPrefCard
              key={open.id}
              libraryId={open.id}
              libraryName={open.name}
              pref={prefsMap.get(open.id) ?? null}
              languages={languages}
              subtitleModes={subtitleModes}
              t={(key) => t(key)}
              onSave={save}
              onDelete={() => remove(open.id)}
            />
          </div>
        ) : null}
      </ActionSheet>
    </>
  );
}
