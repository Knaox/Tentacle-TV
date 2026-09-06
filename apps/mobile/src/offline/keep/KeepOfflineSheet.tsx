import { useMemo, useState } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { LightPresetId, OfflineVariantKind } from "@tentacle-tv/offline-core";
import { BottomSheet, Button } from "@/components/ui";
import { useDiskInfo, useOfflineList } from "@/hooks/offline/useOfflineList";
import { useOfflineCapabilities } from "@/hooks/offline/useOfflineCapabilities";
import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { audioTracks, batchSizeBytes, imageSubtitleTracks, LOCAL_PLATFORM_SUPPORT, sizeFor, type KeepOptions } from "../keepTargets";
import { useWifiOnly } from "../settings";
import { useConnectivity } from "../useConnectivity";
import { AutoDeleteChips, type AutoDeleteValue } from "./AutoDeleteChips";
import { ItemChecklist } from "./ItemChecklist";
import { closeKeepOffline, useKeepOfflineRequest, type KeepOfflineRequest } from "./keepOfflineStore";
import { planForItems } from "./keepPlan";
import { PresetChoice } from "./PresetChoice";
import { SizeSummary } from "./SizeSummary";
import { TrackPickerRow, trackLabel } from "./TrackPickerRow";
import { useKeepOfflineSubmit } from "./useKeepOfflineSubmit";
import { VariantCards } from "./VariantCards";

/** Le dialogue « Garder hors ligne », monté une fois ; ouvert par `openKeepOffline`. */
export function KeepOfflineSheet() {
  const request = useKeepOfflineRequest();
  return (
    <BottomSheet visible={request !== null} onClose={closeKeepOffline} snapPoints={[0.62, 0.95]}>
      {request !== null && <KeepOfflineBody request={request} />}
    </BottomSheet>
  );
}

function KeepOfflineBody({ request }: { request: KeepOfflineRequest }) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const { t: tc } = useTranslation("common");
  const st = useThemedStyles(makeStyles);
  const { capabilities } = useOfflineCapabilities();
  const { data: disk } = useDiskInfo();
  const { networkType } = useConnectivity();
  const wifiOnly = useWifiOnly();

  const userId = useUserId();
  const { data: entries } = useOfflineList(userId);
  // Un lot : chaque épisode a sa case, tous cochés sauf ceux déjà sur l'appareil.
  const onDevice = useMemo(
    () => new Set((entries ?? []).filter((entry) => entry.status === "complete").map((entry) => entry.itemId)),
    [entries],
  );
  const batch = request.mode !== "single";
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const toggle = (itemId: string) => setUnchecked((prev) => {
    const next = new Set(prev);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    return next;
  });
  const items = useMemo(
    () => (batch ? request.items.filter((item) => !onDevice.has(item.Id) && !unchecked.has(item.Id)) : request.items),
    [batch, request.items, onDevice, unchecked],
  );
  const selected = useMemo(() => new Set(items.map((item) => item.Id)), [items]);
  const single = request.mode === "single" && items.length === 1 ? items[0] : null;
  const plan = useMemo(() => planForItems(items, LOCAL_PLATFORM_SUPPORT, capabilities), [items, capabilities]);
  const firstKind = plan.cards[0]?.kind ?? null;
  const [chosenKind, setChosenKind] = useState<OfflineVariantKind | null>(null);
  const kind = chosenKind !== null && plan.cards.some((card) => card.kind === chosenKind) ? chosenKind : firstKind;
  const presets = capabilities.lightPresets.filter((preset) => preset !== "pmax");
  const [preset, setPreset] = useState<LightPresetId>("p720");
  const activePreset = presets.includes(preset) ? preset : ((presets[0] as LightPresetId | undefined) ?? "p720");
  const [audioIndex, setAudioIndex] = useState<number | undefined>(undefined);
  const [burnIndex, setBurnIndex] = useState<number | undefined>(undefined);
  const [autoDelete, setAutoDelete] = useState<AutoDeleteValue>(null);

  const options: KeepOptions = useMemo(() => ({
    kind: kind ?? "original",
    preset: activePreset,
    autoDeleteAfterWatch: autoDelete !== null,
    autoDeleteDelayMinutes: autoDelete ?? 0,
    audioStreamIndex: audioIndex,
    burnSubtitleIndex: burnIndex,
  }), [kind, activePreset, autoDelete, audioIndex, burnIndex]);
  const { submit, submitting, spaceError } = useKeepOfflineSubmit(items, options);

  const card = plan.cards.find((entry) => entry.kind === kind) ?? null;
  const size = kind === null ? { total: null, estimate: false } : batchSizeBytes(items, kind, activePreset);
  const audio = useMemo(() => (single ? audioTracks(single) : []), [single]);
  const imageSubs = useMemo(() => (single ? imageSubtitleTracks(single) : []), [single]);

  const hints: string[] = [];
  if (card !== null && kind === "original" && single !== null) {
    for (const index of card.audio.unplayable) {
      const track = audio.find((stream) => stream.Index === index);
      if (track) hints.push(to("audioUnplayableWarning", { track: trackLabel(track) }));
    }
  }
  if (kind !== null && kind !== "original") hints.push(to("singleAudioTrackHint"));
  if (kind === "light" && plan.excluded.some((entry) => entry.reason === "dolbyVision")) hints.push(to("dolbyVisionColorsHint"));

  const title = request.mode === "season"
    ? to("dialogTitleSeason", { count: items.length })
    : request.mode === "series"
      ? to("dialogTitleSeries")
      : request.mode === "selection"
        ? to("dialogTitleSelection", { count: items.length })
        : to("dialogTitle");
  const subtitle = request.title ?? (single ? single.Name : items[0]?.SeriesName ?? "");

  const nothingLeft = batch && request.items.every((item) => onDevice.has(item.Id));
  if (plan.cards.length === 0 && !nothingLeft && items.length > 0) {
    return (
      <View style={st.body}>
        <Text style={st.title} accessibilityRole="header">{to("noVariantTitle")}</Text>
        <Text style={st.subtitle}>{subtitle}</Text>
        <Text style={st.text}>{to("noVariantMessage")}</Text>
        <Button title={tc("close")} onPress={closeKeepOffline} variant="secondary" fullWidth />
      </View>
    );
  }

  return (
    <View style={st.body}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <Text style={st.title} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={st.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {batch && (
          <ItemChecklist
            items={request.items}
            selected={selected}
            onDevice={onDevice}
            sizeOf={(item) => (kind === null ? null : sizeFor(item, kind, activePreset))}
            onToggle={toggle}
          />
        )}
        <VariantCards cards={plan.cards} value={kind} onChange={setChosenKind} />
        {kind === "light" && <PresetChoice value={activePreset} onChange={setPreset} available={presets} />}
        {single !== null && kind !== "original" && audio.length > 1 && (
          <TrackPickerRow label={t("audioTrack")} emptyLabel={t("audioDefault")} tracks={audio} value={audioIndex} onChange={setAudioIndex} unplayable={card?.audio.unplayable} />
        )}
        {single !== null && kind === "light" && imageSubs.length > 0 && (
          <TrackPickerRow label={t("burnSubtitle")} emptyLabel={t("burnNone")} tracks={imageSubs} value={burnIndex} onChange={setBurnIndex} />
        )}
        <AutoDeleteChips value={autoDelete} onChange={setAutoDelete} />
        <SizeSummary
          sizeBytes={size.total}
          estimate={size.estimate}
          batch={items.length > 1}
          freeBytes={disk?.freeBytes ?? null}
          spaceError={spaceError}
          wifiHint={wifiOnly && networkType === "cellular"}
          hints={hints}
        />
      </ScrollView>
      <View style={st.actions}>
        <Button title={tc("cancel")} onPress={closeKeepOffline} variant="secondary" />
        <Button title={to("start")} onPress={submit} loading={submitting} disabled={items.length === 0 || kind === null} />
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    body: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    scroll: { gap: spacing.lg, paddingBottom: spacing.md },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    subtitle: { ...typography.caption, color: t.colors.text.tertiary, marginTop: -spacing.md },
    text: { ...typography.body, color: t.colors.text.secondary, lineHeight: 20 },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  });
