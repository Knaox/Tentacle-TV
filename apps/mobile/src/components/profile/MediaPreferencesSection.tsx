import { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useLibraries, useLibraryPreferences, useSetLibraryPreference, useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { queuePendingPref, readLibrariesList, readLibraryPrefs, type CachedLibraryPref } from "@tentacle-tv/offline-core";
import { maybeRefreshOfflineCaches, prefsStore } from "@/offline/prefsCache";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { spacing, typography, RADIUS, useTheme, useThemedStyles, type AppTheme } from "../../theme";
import { LibraryPrefCard, type LibraryPrefValues } from "./LibraryPrefCard";

/**
 * La page des langues : une carte par bibliothèque. En ligne, tout vient du
 * serveur ; hors ligne, les bibliothèques et préférences MÉMORISÉES au dernier
 * passage en ligne s'affichent, et une modification part dans la file locale,
 * poussée au serveur au retour (bandeau « enregistré localement »).
 */
export function MediaPreferencesSection() {
  const { t } = useTranslation("preferences");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const offline = useOfflineMode();
  const userId = useUserId();
  const { data: libraries } = useLibraries({ enabled: !offline });
  const { data: prefs } = useLibraryPreferences({ enabled: !offline });
  const setMut = useSetLibraryPreference();
  const { serverUrl } = useServerUrl();
  const { storage } = useTentacleConfig();
  // `nonce` relit la base locale après une écriture en attente.
  const [nonce, setNonce] = useState(0);
  const local = useMemo(() => {
    if (!offline || !userId) return null;
    return { libraries: readLibrariesList(prefsStore, userId), prefs: readLibraryPrefs(prefsStore, userId) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `nonce` : relecture après écriture
  }, [offline, userId, nonce]);

  const rows = local
    ? local.libraries.map((lib) => ({ id: lib.id, name: lib.name }))
    : (libraries ?? []).map((lib) => ({ id: lib.Id, name: lib.Name }));
  const prefList: CachedLibraryPref[] = local ? local.prefs : (prefs ?? []);
  const prefsMap = new Map(prefList.map((p) => [p.libraryId, p]));

  const save = (libraryId: string, values: LibraryPrefValues): void => {
    if (local && userId) {
      queuePendingPref(prefsStore, userId, { libraryId, ...values });
      setNonce((n) => n + 1);
      return;
    }
    setMut.mutate({ libraryId, ...values }, {
      // Le miroir local suit tout de suite : la prochaine lecture hors ligne
      // n'attend pas un passage en ligne pour connaître ce choix.
      onSuccess: () => {
        const token = storage.getItem("tentacle_token");
        if (serverUrl && token && userId) void maybeRefreshOfflineCaches(serverUrl, token, userId, storage, { force: true });
      },
    });
  };

  if (!local && rows.length === 0) return null;

  return (
    <View>
      <Text style={st.title}>{t("title")}</Text>
      <Text style={st.subtitle}>{t("subtitle")}</Text>
      {local && (
        <View style={st.banner} accessibilityRole="text">
          <Feather name="wifi-off" size={14} color={theme.colors.statusPairs.warning.fg} />
          <Text style={st.bannerText}>{t("offlineSavedLocally")}</Text>
        </View>
      )}
      {local && rows.length === 0 && <Text style={st.hint}>{t("offlineNoCacheHint")}</Text>}
      {rows.map((lib) => (
        <LibraryPrefCard
          key={lib.id}
          libraryName={lib.name}
          pref={prefsMap.get(lib.id) ?? null}
          onSave={(values) => save(lib.id, values)}
          saving={!local && setMut.isPending}
        />
      ))}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    title: { ...typography.subtitle, color: t.colors.text.primary, marginBottom: 4 },
    subtitle: { ...typography.caption, color: t.colors.text.tertiary, marginBottom: spacing.lg },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: RADIUS.md,
      backgroundColor: t.colors.statusPairs.warning.bg,
      marginBottom: spacing.md,
    },
    bannerText: { ...typography.caption, color: t.colors.statusPairs.warning.fg, flex: 1, lineHeight: 18 },
    hint: { ...typography.caption, color: t.colors.text.tertiary, lineHeight: 18 },
  });
