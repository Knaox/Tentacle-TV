import { useState, useEffect, useCallback } from "react";
import { View, ScrollView, Text, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useLibraries, useTentacleConfig } from "@tentacle/api-client";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";
import { i18n } from "@tentacle/shared";

type Props = NativeStackScreenProps<RootStackParamList, "Preferences">;

const INTERFACE_LANGS = [
  { code: "fr", labelKey: "preferences:langFr" },
  { code: "en", labelKey: "preferences:langEn" },
];

const AUDIO_LANGS = [
  "fr", "en", "ja", "de", "es", "it", "pt", "ru", "ko", "zh",
  "ar", "pl", "nl", "hi", "sv", "no", "fi", "tr",
];

const SUBTITLE_MODES = ["none", "always", "forced", "signs"] as const;
type SubtitleMode = (typeof SUBTITLE_MODES)[number];

const SUBTITLE_MODE_KEYS: Record<SubtitleMode, string> = {
  none: "preferences:modeDisabled",
  always: "preferences:modeAlwaysOn",
  forced: "preferences:modeForcedOnly",
  signs: "preferences:modeSignsSongs",
};

interface LibPref {
  libraryId: string;
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: SubtitleMode;
}

function langKey(code: string) {
  return `preferences:lang${code.charAt(0).toUpperCase()}${code.slice(1)}`;
}

export function PreferencesScreen({ navigation }: Props) {
  const { t } = useTranslation(["preferences", "common", "nav"]);
  const { storage } = useTentacleConfig();
  const { data: libraries } = useLibraries();

  const [currentLang, setCurrentLang] = useState(i18n.language || "en");
  const [prefs, setPrefs] = useState<LibPref[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const serverUrl = storage.getItem("tentacle_server_url") || "";
  const token = storage.getItem("tentacle_token") || "";

  // Fetch existing preferences
  useEffect(() => {
    if (!serverUrl || !token) { setLoading(false); return; }
    fetch(`${serverUrl}/api/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((data: LibPref[]) => setPrefs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverUrl, token]);

  const getPref = useCallback((libId: string): LibPref => {
    return prefs.find((p) => p.libraryId === libId) || {
      libraryId: libId, audioLang: null, subtitleLang: null, subtitleMode: "none",
    };
  }, [prefs]);

  const updatePref = useCallback((libId: string, patch: Partial<LibPref>) => {
    setPrefs((prev) => {
      const idx = prev.findIndex((p) => p.libraryId === libId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...patch };
        return updated;
      }
      return [...prev, { libraryId: libId, audioLang: null, subtitleLang: null, subtitleMode: "none", ...patch }];
    });
  }, []);

  const savePref = useCallback(async (pref: LibPref) => {
    if (!serverUrl || !token) return;
    setSaving(true);
    try {
      await fetch(`${serverUrl}/api/preferences`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(pref),
      });
    } catch { /* silent */ }
    setSaving(false);
  }, [serverUrl, token]);

  const changeInterfaceLang = useCallback((code: string) => {
    setCurrentLang(code);
    i18n.changeLanguage(code);
    storage.setItem("tentacle_language", code);
    // Sync to backend (bidirectional — web will pick it up)
    if (serverUrl && token) {
      fetch(`${serverUrl}/api/preferences/language`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ language: code }),
      }).catch(() => {});
    }
  }, [storage, serverUrl, token]);

  const cycleAudioLang = useCallback((libId: string, current: string | null) => {
    const idx = current ? AUDIO_LANGS.indexOf(current) : -1;
    const next = AUDIO_LANGS[(idx + 1) % AUDIO_LANGS.length];
    const pref = { ...getPref(libId), audioLang: next };
    updatePref(libId, { audioLang: next });
    savePref(pref);
  }, [getPref, updatePref, savePref]);

  const cycleSubtitleMode = useCallback((libId: string, current: SubtitleMode) => {
    const idx = SUBTITLE_MODES.indexOf(current);
    const next = SUBTITLE_MODES[(idx + 1) % SUBTITLE_MODES.length];
    const pref = { ...getPref(libId), subtitleMode: next };
    updatePref(libId, { subtitleMode: next });
    savePref(pref);
  }, [getPref, updatePref, savePref]);

  const cycleSubtitleLang = useCallback((libId: string, current: string | null) => {
    const idx = current ? AUDIO_LANGS.indexOf(current) : -1;
    const next = AUDIO_LANGS[(idx + 1) % AUDIO_LANGS.length];
    const pref = { ...getPref(libId), subtitleLang: next };
    updatePref(libId, { subtitleLang: next });
    savePref(pref);
  }, [getPref, updatePref, savePref]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0f" }}>
      <ScrollView contentContainerStyle={{ padding: 48, paddingBottom: 80 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Focusable onPress={() => navigation.goBack()} hasTVPreferredFocus>
            <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: "#c4b5fd", fontSize: 16, fontWeight: "600" }}>
                {t("common:back")}
              </Text>
            </View>
          </Focusable>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", marginLeft: 24 }}>
            {t("preferences:title")}
          </Text>
          {saving && <ActivityIndicator size="small" color="#8b5cf6" style={{ marginLeft: 16 }} />}
        </View>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginBottom: 32 }}>
          {t("preferences:subtitle")}
        </Text>

        {/* Interface Language */}
        <SectionTitle text={t("preferences:interfaceLanguage")} />
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 32 }}>
          {INTERFACE_LANGS.map((lang) => (
            <Focusable key={lang.code} onPress={() => changeInterfaceLang(lang.code)}>
              <View style={{
                paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
                backgroundColor: currentLang === lang.code ? "#8b5cf6" : "rgba(255,255,255,0.06)",
                borderWidth: 2, borderColor: currentLang === lang.code ? "#8b5cf6" : "transparent",
              }}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: currentLang === lang.code ? "700" : "400" }}>
                  {t(lang.labelKey)}
                </Text>
              </View>
            </Focusable>
          ))}
        </View>

        {loading && (
          <ActivityIndicator size="large" color="#8b5cf6" style={{ marginTop: 24 }} />
        )}

        {/* Per-library preferences */}
        {!loading && (libraries ?? []).map((lib) => {
          const pref = getPref(lib.Id);
          return (
            <View key={lib.Id} style={{
              backgroundColor: "#12121a", borderRadius: 12, padding: 24, marginBottom: 20,
              borderWidth: 1, borderColor: "#1e1e2e",
            }}>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 16 }}>
                {lib.Name}
              </Text>

              <View style={{ flexDirection: "row", gap: 24, flexWrap: "wrap" }}>
                {/* Audio language */}
                <PrefButton
                  label={t("preferences:audio")}
                  value={pref.audioLang ? t(langKey(pref.audioLang)) : t("preferences:default")}
                  onPress={() => cycleAudioLang(lib.Id, pref.audioLang)}
                />
                {/* Subtitle mode */}
                <PrefButton
                  label={t("preferences:subtitleMode")}
                  value={t(SUBTITLE_MODE_KEYS[pref.subtitleMode])}
                  onPress={() => cycleSubtitleMode(lib.Id, pref.subtitleMode)}
                />
                {/* Subtitle language */}
                <PrefButton
                  label={t("preferences:subtitles")}
                  value={pref.subtitleLang ? t(langKey(pref.subtitleLang)) : t("preferences:default")}
                  onPress={() => cycleSubtitleLang(lib.Id, pref.subtitleLang)}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <Text style={{ color: "#c4b5fd", fontSize: 17, fontWeight: "700", marginBottom: 12 }}>
      {text}
    </Text>
  );
}

function PrefButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Focusable onPress={onPress}>
      <View style={{
        backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10,
        paddingHorizontal: 20, paddingVertical: 14, minWidth: 180,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
      }}>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 4 }}>
          {label}
        </Text>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
          {value}
        </Text>
      </View>
    </Focusable>
  );
}
