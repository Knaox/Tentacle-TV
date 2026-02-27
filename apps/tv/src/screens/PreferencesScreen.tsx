import { useState, useEffect, useCallback } from "react";
import { View, ScrollView, Text, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useLibraries, useTentacleConfig } from "@tentacle/api-client";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";
import { SelectionModal } from "../components/SelectionModal";
import { useTVRemote } from "../components/focus/useTVRemote";
import { i18n } from "@tentacle/shared";
import { getLanguageDisplayName } from "../utils/languageNames";
import { Colors, Spacing, Typography, Radius } from "../theme/colors";

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

interface ModalState {
  type: "audio" | "subtitleLang" | "subtitleMode";
  libraryId: string;
  currentValue: string | null;
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
  const [modal, setModal] = useState<ModalState | null>(null);

  const serverUrl = storage.getItem("tentacle_server_url") || "";
  const token = storage.getItem("tentacle_token") || "";

  useTVRemote({
    onBack: () => {
      if (modal) { setModal(null); return; }
      navigation.goBack();
    },
  });

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
    if (serverUrl && token) {
      fetch(`${serverUrl}/api/preferences/language`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ language: code }),
      }).catch(() => {});
    }
  }, [storage, serverUrl, token]);

  const handleModalSelect = useCallback((value: string) => {
    if (!modal) return;
    const pref = getPref(modal.libraryId);
    let updated: LibPref;
    if (modal.type === "audio") {
      updated = { ...pref, audioLang: value };
      updatePref(modal.libraryId, { audioLang: value });
    } else if (modal.type === "subtitleLang") {
      updated = { ...pref, subtitleLang: value };
      updatePref(modal.libraryId, { subtitleLang: value });
    } else {
      updated = { ...pref, subtitleMode: value as SubtitleMode };
      updatePref(modal.libraryId, { subtitleMode: value as SubtitleMode });
    }
    savePref(updated);
    setModal(null);
  }, [modal, getPref, updatePref, savePref]);

  const audioOptions = AUDIO_LANGS.map((code) => ({
    value: code,
    label: getLanguageDisplayName(code),
  }));

  const subtitleModeOptions = SUBTITLE_MODES.map((mode) => ({
    value: mode,
    label: t(SUBTITLE_MODE_KEYS[mode]),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.screenPadding, paddingBottom: 80 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Focusable onPress={() => navigation.goBack()} hasTVPreferredFocus={!modal}>
            <View style={{
              paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.small,
              backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: Colors.glassBorder,
            }}>
              <Text style={{ color: Colors.accentPurpleLight, ...Typography.buttonMedium }}>
                {t("common:back")}
              </Text>
            </View>
          </Focusable>
          <Text style={{ color: Colors.textPrimary, ...Typography.pageTitle, marginLeft: 24 }}>
            {t("preferences:title")}
          </Text>
          {saving && <ActivityIndicator size="small" color={Colors.accentPurple} style={{ marginLeft: 16 }} />}
        </View>
        <Text style={{ color: Colors.textMuted, fontSize: 15, marginBottom: 40 }}>
          {t("preferences:subtitle")}
        </Text>

        {/* Interface Language */}
        <SectionTitle text={t("preferences:interfaceLanguage")} />
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 48 }}>
          {INTERFACE_LANGS.map((lang) => (
            <Focusable key={lang.code} onPress={() => changeInterfaceLang(lang.code)}>
              <View style={{
                paddingHorizontal: 28, paddingVertical: 14, borderRadius: Radius.button,
                backgroundColor: currentLang === lang.code ? Colors.accentPurple : "rgba(255,255,255,0.04)",
                borderWidth: 2, borderColor: currentLang === lang.code ? Colors.accentPurple : Colors.glassBorder,
              }}>
                <Text style={{
                  color: Colors.textPrimary, fontSize: 16,
                  fontWeight: currentLang === lang.code ? "700" : "400",
                }}>
                  {t(lang.labelKey)}
                </Text>
              </View>
            </Focusable>
          ))}
        </View>

        {loading && <ActivityIndicator size="large" color={Colors.accentPurple} style={{ marginTop: 24 }} />}

        {/* Per-library preferences */}
        {!loading && (libraries ?? []).map((lib) => {
          const pref = getPref(lib.Id);
          return (
            <View key={lib.Id} style={{
              backgroundColor: Colors.bgSurface, borderRadius: Radius.card,
              padding: Spacing.glassPadding, marginBottom: 24,
              borderWidth: 1, borderColor: Colors.glassBorder,
            }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 22, fontWeight: "700", marginBottom: 24 }}>
                {lib.Name}
              </Text>
              <View style={{ flexDirection: "row", gap: 20, flexWrap: "wrap" }}>
                <PrefButton
                  label={t("preferences:audio")}
                  value={pref.audioLang ? getLanguageDisplayName(pref.audioLang) : t("preferences:default")}
                  onPress={() => setModal({ type: "audio", libraryId: lib.Id, currentValue: pref.audioLang })}
                />
                <PrefButton
                  label={t("preferences:subtitleMode")}
                  value={t(SUBTITLE_MODE_KEYS[pref.subtitleMode])}
                  onPress={() => setModal({ type: "subtitleMode", libraryId: lib.Id, currentValue: pref.subtitleMode })}
                />
                <PrefButton
                  label={t("preferences:subtitles")}
                  value={pref.subtitleLang ? getLanguageDisplayName(pref.subtitleLang) : t("preferences:default")}
                  onPress={() => setModal({ type: "subtitleLang", libraryId: lib.Id, currentValue: pref.subtitleLang })}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Selection modal */}
      {modal && (
        <SelectionModal
          title={
            modal.type === "audio" ? t("preferences:audio")
            : modal.type === "subtitleLang" ? t("preferences:subtitles")
            : t("preferences:subtitleMode")
          }
          options={
            modal.type === "subtitleMode" ? subtitleModeOptions : audioOptions
          }
          selectedValue={modal.currentValue}
          onSelect={handleModalSelect}
          onClose={() => setModal(null)}
        />
      )}
    </View>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <Text style={{ color: Colors.accentPurpleLight, fontSize: 17, fontWeight: "700", marginBottom: 16 }}>
      {text}
    </Text>
  );
}

function PrefButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Focusable onPress={onPress}>
      <View style={{
        backgroundColor: "rgba(255,255,255,0.03)", borderRadius: Radius.button,
        paddingHorizontal: 24, paddingVertical: 16, minWidth: 200,
        borderWidth: 1, borderColor: Colors.glassBorder,
      }}>
        <Text style={{ color: Colors.textTertiary, ...Typography.caption, marginBottom: 6 }}>
          {label}
        </Text>
        <Text style={{ color: Colors.textPrimary, ...Typography.buttonMedium }}>
          {value}
        </Text>
      </View>
    </Focusable>
  );
}
