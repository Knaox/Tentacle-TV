import { useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import {
  useLibraries,
  useLibraryPreferences,
  useSetLibraryPreference,
  type LibraryPreference,
} from "@tentacle-tv/api-client";
import { colors, spacing, typography } from "../../theme";

const LANGUAGES: { code: string; labelKey: string }[] = [
  { code: "fre", labelKey: "langFr" },
  { code: "fre-vff", labelKey: "langFrVff" },
  { code: "fre-vfq", labelKey: "langFrVfq" },
  { code: "eng", labelKey: "langEn" },
  { code: "jpn", labelKey: "langJa" },
  { code: "ger", labelKey: "langDe" },
  { code: "spa", labelKey: "langEs" },
  { code: "ita", labelKey: "langIt" },
  { code: "por", labelKey: "langPt" },
  { code: "rus", labelKey: "langRu" },
  { code: "kor", labelKey: "langKo" },
  { code: "chi", labelKey: "langZh" },
];

const SUBTITLE_MODES: { code: string; labelKey: string }[] = [
  { code: "none", labelKey: "modeDisabled" },
  { code: "always", labelKey: "modeAlwaysOn" },
  { code: "forced", labelKey: "modeForcedOnly" },
  { code: "signs", labelKey: "modeSignsSongs" },
];

export function MediaPreferencesSection() {
  const { t } = useTranslation("preferences");
  const { data: libraries } = useLibraries();
  const { data: prefs } = useLibraryPreferences();
  const prefsMap = useMemo(
    () => new Map(prefs?.map((p) => [p.libraryId, p]) ?? []),
    [prefs],
  );

  if (!libraries || libraries.length === 0) return null;

  return (
    <View>
      <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: 4 }}>
        {t("title")}
      </Text>
      <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg }}>
        {t("subtitle")}
      </Text>
      {libraries.map((lib) => (
        <LibraryPrefCard
          key={lib.Id}
          libraryId={lib.Id}
          libraryName={lib.Name}
          pref={prefsMap.get(lib.Id) ?? null}
        />
      ))}
    </View>
  );
}

function LibraryPrefCard({ libraryId, libraryName, pref }: {
  libraryId: string;
  libraryName: string;
  pref: LibraryPreference | null;
}) {
  const { t } = useTranslation(["preferences", "common"]);
  const setMut = useSetLibraryPreference();
  const [editing, setEditing] = useState(false);
  const [audio, setAudio] = useState(pref?.audioLang ?? "");
  const [sub, setSub] = useState(pref?.subtitleLang ?? "");
  const [mode, setMode] = useState(pref?.subtitleMode ?? "none");

  const handleSave = useCallback(() => {
    setMut.mutate({
      libraryId,
      audioLang: audio || null,
      subtitleLang: sub || null,
      subtitleMode: mode as "none" | "always" | "forced" | "signs",
    });
    setEditing(false);
  }, [setMut, libraryId, audio, sub, mode]);

  const audioLabel = LANGUAGES.find((l) => l.code === audio);
  const subLabel = LANGUAGES.find((l) => l.code === sub);
  const modeLabel = SUBTITLE_MODES.find((m) => m.code === mode);

  return (
    <View style={{
      backgroundColor: "rgba(255,255,255,0.03)",
      borderRadius: spacing.cardRadius,
      borderWidth: 1, borderColor: colors.border,
      padding: spacing.md, marginBottom: spacing.md,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: editing ? spacing.md : 0 }}>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary }}>{libraryName}</Text>
        <Pressable onPress={() => setEditing(!editing)} hitSlop={8}>
          <Text style={{ ...typography.small, color: colors.accent }}>
            {editing ? t("common:close") : t("preferences:audio") + " / " + t("preferences:subtitles")}
          </Text>
        </Pressable>
      </View>

      {!editing && (audioLabel || subLabel) && (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {audioLabel && (
            <View style={{ backgroundColor: "rgba(139,92,246,0.15)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ ...typography.badge, color: colors.accent }}>
                {t("audio")}: {t(audioLabel.labelKey)}
              </Text>
            </View>
          )}
          {subLabel && (
            <View style={{ backgroundColor: "rgba(59,130,246,0.15)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ ...typography.badge, color: "#60A5FA" }}>
                {t("subtitles")}: {t(subLabel.labelKey)} ({modeLabel ? t(modeLabel.labelKey) : ""})
              </Text>
            </View>
          )}
        </View>
      )}

      {editing && (
        <View>
          <Text style={{ ...typography.caption, color: colors.textSecondary, marginBottom: 6 }}>{t("audio")}</Text>
          <ChipRow items={LANGUAGES} selected={audio} onSelect={setAudio} t={t} />

          <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.md, marginBottom: 6 }}>{t("subtitles")}</Text>
          <ChipRow
            items={[{ code: "", labelKey: "none" }, ...LANGUAGES]}
            selected={sub}
            onSelect={setSub}
            t={t}
          />

          <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.md, marginBottom: 6 }}>{t("subtitleMode")}</Text>
          <ChipRow items={SUBTITLE_MODES} selected={mode} onSelect={(c) => setMode(c as typeof mode)} t={t} />

          <Pressable
            onPress={handleSave}
            style={{
              backgroundColor: colors.accent,
              borderRadius: spacing.buttonRadius,
              paddingVertical: 10, alignItems: "center", marginTop: spacing.lg,
            }}
          >
            <Text style={{ ...typography.bodyBold, color: "#fff" }}>
              {setMut.isPending ? "..." : t("common:save")}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ChipRow({ items, selected, onSelect, t }: {
  items: { code: string; labelKey: string }[];
  selected: string;
  onSelect: (code: string) => void;
  t: (key: string) => string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {items.map((item) => (
          <Pressable
            key={item.code}
            onPress={() => onSelect(item.code)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8,
              borderRadius: spacing.buttonRadius,
              backgroundColor: selected === item.code ? colors.accent : "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: selected === item.code ? colors.accent : colors.border,
            }}
          >
            <Text style={{
              fontSize: 12, fontWeight: "600",
              color: selected === item.code ? "#fff" : colors.textSecondary,
            }}>
              {t(item.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
