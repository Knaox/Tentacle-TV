import { useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import {
  useLibraries,
  useLibraryPreferences,
  useSetLibraryPreference,
  type LibraryPreference,
} from "@tentacle-tv/api-client";
import { spacing, typography, FONT_FAMILY, useTheme } from "../../theme";

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
  const theme = useTheme();
  const { data: libraries } = useLibraries();
  const { data: prefs } = useLibraryPreferences();
  const prefsMap = useMemo(
    () => new Map(prefs?.map((p) => [p.libraryId, p]) ?? []),
    [prefs],
  );

  if (!libraries || libraries.length === 0) return null;

  return (
    <View>
      <Text style={{ ...typography.subtitle, color: theme.colors.text.primary, marginBottom: 4 }}>
        {t("title")}
      </Text>
      <Text style={{ ...typography.caption, color: theme.colors.text.tertiary, marginBottom: spacing.lg }}>
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
  const theme = useTheme();
  const setMut = useSetLibraryPreference();
  const [editing, setEditing] = useState(false);
  const [audio, setAudio] = useState("");
  const [sub, setSub] = useState("");
  const [mode, setMode] = useState<"none" | "always" | "forced" | "signs">("none");

  // Les états locaux ne servent QU'À l'édition, seedés à l'ouverture depuis la
  // valeur DB. (Avant : seedés au premier render — les cartes montaient avant
  // l'arrivée de la query prefs → les préférences en base ne s'affichaient
  // jamais, l'état local restant figé à vide.)
  const toggleEditing = useCallback(() => {
    setEditing((was) => {
      if (!was) {
        setAudio(pref?.audioLang ?? "");
        setSub(pref?.subtitleLang ?? "");
        setMode(pref?.subtitleMode ?? "none");
      }
      return !was;
    });
  }, [pref]);

  const handleSave = useCallback(() => {
    setMut.mutate({
      libraryId,
      audioLang: audio || null,
      subtitleLang: sub || null,
      subtitleMode: mode,
    });
    setEditing(false);
  }, [setMut, libraryId, audio, sub, mode]);

  // Affichage (mode lecture) : dérivé de la préférence EN BASE, pas de l'état local.
  const audioLabel = LANGUAGES.find((l) => l.code === pref?.audioLang);
  const subLabel = LANGUAGES.find((l) => l.code === pref?.subtitleLang);
  const modeLabel = SUBTITLE_MODES.find((m) => m.code === (pref?.subtitleMode ?? "none"));

  return (
    <View style={{
      backgroundColor: theme.colors.fill.faint,
      borderRadius: spacing.cardRadius,
      borderWidth: 1, borderColor: theme.colors.border.subtle,
      padding: spacing.md, marginBottom: spacing.md,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: editing ? spacing.md : 0 }}>
        <Text style={{ ...typography.bodyBold, color: theme.colors.text.primary }}>{libraryName}</Text>
        <Pressable onPress={toggleEditing} hitSlop={8}>
          <Text style={{ ...typography.small, color: theme.colors.brand.violet }}>
            {editing ? t("common:close") : t("preferences:audio") + " / " + t("preferences:subtitles")}
          </Text>
        </Pressable>
      </View>

      {!editing && (audioLabel || subLabel) && (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {audioLabel && (
            <View style={{ backgroundColor: theme.colors.brand.soft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ ...typography.badge, color: theme.colors.brand.violet }}>
                {t("audio")}: {t(audioLabel.labelKey)}
              </Text>
            </View>
          )}
          {subLabel && (
            <View style={{ backgroundColor: theme.colors.statusPairs.info.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ ...typography.badge, color: theme.colors.statusPairs.info.fg }}>
                {t("subtitles")}: {t(subLabel.labelKey)} ({modeLabel ? t(modeLabel.labelKey) : ""})
              </Text>
            </View>
          )}
        </View>
      )}

      {editing && (
        <View>
          <Text style={{ ...typography.caption, color: theme.colors.text.secondary, marginBottom: 6 }}>{t("audio")}</Text>
          <ChipRow items={LANGUAGES} selected={audio} onSelect={setAudio} t={t} />

          <Text style={{ ...typography.caption, color: theme.colors.text.secondary, marginTop: spacing.md, marginBottom: 6 }}>{t("subtitles")}</Text>
          <ChipRow
            items={[{ code: "", labelKey: "none" }, ...LANGUAGES]}
            selected={sub}
            onSelect={setSub}
            t={t}
          />

          <Text style={{ ...typography.caption, color: theme.colors.text.secondary, marginTop: spacing.md, marginBottom: 6 }}>{t("subtitleMode")}</Text>
          <ChipRow items={SUBTITLE_MODES} selected={mode} onSelect={(c) => setMode(c as typeof mode)} t={t} />

          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [{
              backgroundColor: theme.colors.cta.primaryBg,
              borderRadius: spacing.buttonRadius,
              paddingVertical: 12,
              alignItems: "center",
              marginTop: spacing.lg,
              opacity: pressed ? 0.88 : 1,
              shadowColor: theme.colors.brand.violet,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.45,
              shadowRadius: 18,
              elevation: 8,
            }]}
            accessibilityRole="button"
          >
            <Text style={{ ...typography.bodyBold, fontFamily: FONT_FAMILY.bold, color: theme.colors.cta.primaryFg, letterSpacing: 0.1 }}>
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
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {items.map((item) => {
          const isActive = selected === item.code;
          return (
            <Pressable
              key={item.code}
              onPress={() => onSelect(item.code)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: isActive ? theme.colors.brand.soft : theme.colors.fill.subtle,
                borderWidth: 1,
                borderColor: isActive ? theme.colors.brand.glow : theme.colors.border.subtle,
                minHeight: 32,
                justifyContent: "center",
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={{
                fontSize: 12,
                fontFamily: isActive ? FONT_FAMILY.semibold : FONT_FAMILY.medium,
                color: isActive ? theme.colors.brand.light : theme.colors.text.secondary,
                letterSpacing: 0.1,
              }}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
