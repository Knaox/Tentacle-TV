import { useRef, useState } from "react";
import { Alert, Linking, Platform, ScrollView, Share, StyleSheet, Text, View, findNodeHandle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { statsShareFailure, useMyStatsShare, useRevokeStatsShare, useSaveStatsShare } from "@tentacle-tv/api-client";
import { VIEWING_STATS_PERIODS, type ViewingStatsPeriod } from "@tentacle-tv/shared";
import { BottomSheet, Button } from "@/components/ui";
import { SegmentedChoice } from "@/components/settings/SegmentedChoice";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { StatsPrivacyLists } from "./StatsPrivacyLists";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** La période affichée par l'écran : celle que propose un nouveau lien. */
  defaultPeriod: ViewingStatsPeriod;
}

type Notice = { tone: "success" | "error"; text: string } | null;

/**
 * « Partager mes statistiques » au mobile : la période partagée, ce qui devient
 * public face à ce qui reste privé, puis la feuille de partage du système avec
 * le lien (elle sait aussi le copier). Le lien se crée au premier partage — un
 * jeton que personne ne connaît tant qu'on ne l'a pas envoyé ; « Voir la page
 * publique » l'ouvre dans le navigateur, telle que la verront les autres.
 * Changer la période d'un lien existant le met à jour (même jeton) ; révoquer
 * se confirme.
 */
export function ShareStatsSheet({ visible, onClose, defaultPeriod }: Props) {
  const { t } = useTranslation("statsShare");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const { serverUrl } = useServerUrl();
  const mine = useMyStatsShare(visible);
  const save = useSaveStatsShare();
  const revoke = useRevokeStatsShare();
  const [draft, setDraft] = useState<ViewingStatsPeriod>(defaultPeriod);
  const [notice, setNotice] = useState<Notice>(null);
  const anchorRef = useRef<View>(null);

  const link = mine.data?.token ? { token: mine.data.token, period: mine.data.period ?? defaultPeriod } : null;
  const period = link ? (save.isPending && save.variables ? save.variables : link.period) : draft;
  const periodLabel = (p: ViewingStatsPeriod) => t(`period_${p}`);
  const failure = mine.error ?? save.error;
  const outdated = failure !== null && statsShareFailure(failure) === "outdated";
  const urlOf = (token: string) => `${(serverUrl ?? "").replace(/\/$/, "")}/share/${token}`;

  const choose = (next: string) => {
    const p = next as ViewingStatsPeriod;
    if (!link) return setDraft(p);
    if (p === link.period) return;
    setNotice(null);
    save.mutate(p, {
      onSuccess: () => setNotice({ tone: "success", text: t("periodSaved", { period: periodLabel(p) }) }),
      onError: (err) => setNotice(statsShareFailure(err) === "outdated" ? null : { tone: "error", text: t("periodError") }),
    });
  };

  /** Le lien, créé s'il le faut ; null quand la création a échoué (et l'a dit). */
  const ensureLink = async (): Promise<string | null> => {
    if (link) return link.token;
    try {
      return (await save.mutateAsync(draft)).token;
    } catch (err) {
      setNotice(statsShareFailure(err) === "outdated" ? null : { tone: "error", text: t("error") });
      return null;
    }
  };

  const shareLink = async () => {
    setNotice(null);
    const token = await ensureLink();
    if (!token) return;
    const url = urlOf(token);
    // iOS exige une URL absolue, sinon la feuille ne s'ouvre pas — en silence.
    if (!/^https?:\/\//.test(url)) return setNotice({ tone: "error", text: t("shareFailed") });
    // Sur iOS, `url` seule (un message en double casse l'aperçu) ; Android préfère `message`.
    // Sur iPad la feuille est un popover : ancrée sur le bouton.
    const anchor = Platform.OS === "ios" ? (findNodeHandle(anchorRef.current) ?? undefined) : undefined;
    try {
      await Share.share(Platform.OS === "ios" ? { url } : { message: url }, anchor != null ? { anchor } : undefined);
    } catch {
      setNotice({ tone: "error", text: t("shareFailed") });
    }
  };

  const preview = async () => {
    setNotice(null);
    const token = await ensureLink();
    if (token) Linking.openURL(urlOf(token)).catch(() => setNotice({ tone: "error", text: t("shareFailed") }));
  };

  const confirmRevoke = () =>
    Alert.alert(t("revokeConfirmTitle"), t("revokeConfirmBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("revokeConfirm"),
        style: "destructive",
        onPress: () =>
          revoke.mutate(undefined, {
            onSuccess: () => setNotice({ tone: "success", text: t("revoked") }),
            onError: () => setNotice({ tone: "error", text: t("revokeError") }),
          }),
      },
    ]);

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.82, 0.95]}>
      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        <Text style={st.title} accessibilityRole="header">{t("title")}</Text>
        <Text style={st.lead}>{t("lead")}</Text>

        <View style={st.periodHead}>
          <Text style={st.label}>{t("periodLabel")}</Text>
          {link && <Text style={st.meta}>{t("linkActive", { period: periodLabel(link.period) })}</Text>}
        </View>
        <SegmentedChoice
          accessibilityLabel={t("periodLabel")}
          value={period}
          onChange={choose}
          options={VIEWING_STATS_PERIODS.map((p) => ({ value: p, label: periodLabel(p) }))}
        />

        <StatsPrivacyLists />

        {notice && (
          <View style={st.notice} accessibilityLiveRegion="polite" accessibilityRole={notice.tone === "error" ? "alert" : "text"}>
            <Feather name={notice.tone === "error" ? "alert-circle" : "check-circle"} size={15} color={notice.tone === "error" ? colors.status.error : colors.status.success} />
            <Text style={[st.noticeText, { color: notice.tone === "error" ? colors.status.error : colors.status.success }]}>{notice.text}</Text>
          </View>
        )}

        {outdated ? (
          <View style={st.outdated}>
            <Feather name="server" size={16} color={colors.text.secondary} />
            <Text style={st.outdatedText}>{t("outdated")}</Text>
          </View>
        ) : (
          <View style={st.actions}>
            <View ref={anchorRef} collapsable={false}>
              <Button title={t("shareLink")} onPress={() => void shareLink()} loading={save.isPending && !link} fullWidth />
            </View>
            <Button title={t("preview")} variant="secondary" onPress={() => void preview()} disabled={save.isPending} fullWidth />
            {link && <Button title={t("revoke")} variant="danger" onPress={confirmRevoke} loading={revoke.isPending} fullWidth style={st.revoke} />}
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    lead: { ...typography.caption, marginTop: -spacing.xs, lineHeight: 18, color: t.colors.text.tertiary },
    periodHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
    label: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    meta: { ...typography.small, color: t.colors.text.tertiary },
    notice: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    noticeText: { ...typography.caption, flex: 1, lineHeight: 18 },
    outdated: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: t.colors.fill.faint },
    outdatedText: { ...typography.caption, flex: 1, lineHeight: 18, color: t.colors.text.secondary },
    actions: { gap: spacing.sm, marginTop: spacing.xs },
    revoke: { marginTop: spacing.xs },
  });
