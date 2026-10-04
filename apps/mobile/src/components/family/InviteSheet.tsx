import { memo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useFamilyCandidates, useSendFamilyInvitation } from "@tentacle-tv/api-client";
import type { FamilyCandidateDto } from "@tentacle-tv/shared";
import { UserAvatar } from "@/components/admin/sessions/UserAvatar";
import { useFamilyText } from "@/family/useFamilyText";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { showToast } from "@/notices/toastStore";
import { FONT_FAMILY, RADIUS, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { FamilySheet } from "./FamilySheet";
import { makeFamilyFormStyles } from "./familyFormStyles";

/** La saisie se pose avant d'interroger le serveur (borné à 30 lectures par minute). */
const SEARCH_DELAY_MS = 300;

/**
 * Inviter un compte du serveur. Les candidats viennent du SERVEUR : les
 * comptes de l'écran de connexion de Jellyfin filtrés par la saisie, un
 * compte caché seulement par son nom exact — jamais un invité, soi-même, un
 * membre, une invitation en attente ni un compte désactivé. Rien ne
 * distingue ici un compte caché d'un nom qui n'existe pas.
 */
export function InviteSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(["familyWeb", "familyMobile"]);
  const theme = useTheme();
  const form = useThemedStyles(makeFamilyFormStyles);
  const st = useThemedStyles(makeStyles);
  const { errorText } = useFamilyText();
  const [query, setQuery] = useState("");
  const settled = useDebouncedValue(query, SEARCH_DELAY_MS);
  const candidates = useFamilyCandidates(settled);
  const invite = useSendFamilyInvitation();
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const send = (candidate: FamilyCandidateDto) => {
    setError(null);
    invite.mutate(candidate.userId, {
      onSuccess: () => {
        haptic("success");
        setSent((previous) => new Set(previous).add(candidate.userId));
        showToast({ title: t("familyWeb:invite.sent", { name: candidate.name }) });
      },
      onError: (failure) => setError(errorText(failure)),
    });
  };

  const list = candidates.data ?? [];
  const searching = candidates.isFetching || settled !== query;
  const empty = settled.trim() ? t("familyWeb:invite.noMatch", { query: settled.trim() }) : t("familyWeb:invite.empty");

  return (
    <FamilySheet title={t("familyWeb:invite.title")} closeLabel={t("familyWeb:close")} onClose={onClose}>
      <View style={st.search}>
        <Feather name="search" size={17} color={theme.colors.text.quaternary} style={st.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("familyWeb:invite.searchPlaceholder")}
          placeholderTextColor={theme.colors.text.quaternary}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel={t("familyWeb:invite.searchLabel")}
          accessibilityHint={t("familyWeb:invite.hint")}
          style={[form.field, st.searchField]}
        />
      </View>
      <Text style={form.hint}>{t("familyWeb:invite.hint")}</Text>

      <View style={st.list} accessibilityState={{ busy: searching }}>
        {candidates.isError ? (
          <Text style={[st.message, st.messageError]}>{t("familyWeb:invite.loadError")}</Text>
        ) : list.length === 0 ? (
          searching ? <ActivityIndicator style={st.spinner} color={theme.colors.brand.light} /> : <Text style={st.message}>{empty}</Text>
        ) : (
          list.map((candidate, index) => (
            <CandidateRow
              key={candidate.userId}
              candidate={candidate}
              last={index === list.length - 1}
              done={sent.has(candidate.userId)}
              disabled={invite.isPending}
              onInvite={send}
            />
          ))
        )}
      </View>

      {error ? <Text style={form.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
    </FamilySheet>
  );
}

const CandidateRow = memo(function CandidateRow({ candidate, last, done, disabled, onInvite }: {
  candidate: FamilyCandidateDto;
  last: boolean;
  done: boolean;
  disabled: boolean;
  onInvite: (candidate: FamilyCandidateDto) => void;
}) {
  const { t } = useTranslation(["familyWeb", "familyMobile"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={[st.row, !last && st.rowBordered]}>
      <UserAvatar userId={candidate.userId} name={candidate.name} hasAvatar={candidate.imageTag !== null} imageTag={candidate.imageTag} size={36} />
      <Text style={st.name} numberOfLines={1}>{candidate.name}</Text>
      {done ? (
        <View style={st.done} accessible accessibilityLabel={`${t("familyMobile:sent")} — ${candidate.name}`}>
          <Feather name="check" size={15} color={theme.colors.status.success} />
          <Text style={st.doneText}>{t("familyMobile:sent")}</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => onInvite(candidate)}
          disabled={disabled}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${t("familyWeb:invite.send")} — ${candidate.name}`}
          style={({ pressed }) => [st.invite, (pressed || disabled) && st.dim]}
        >
          <Text style={st.inviteText}>{t("familyWeb:invite.send")}</Text>
        </Pressable>
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    search: { justifyContent: "center" },
    searchIcon: { position: "absolute", left: spacing.md, zIndex: 1 },
    searchField: { paddingLeft: spacing.md + 26 },
    list: {
      marginTop: spacing.lg,
      minHeight: 120,
      borderRadius: RADIUS.lg,
      backgroundColor: t.colors.surface.s1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      overflow: "hidden",
      justifyContent: "center",
    },
    spinner: { marginVertical: spacing.xl },
    message: { ...typography.body, color: t.colors.text.tertiary, textAlign: "center", padding: spacing.lg },
    messageError: { color: t.colors.statusPairs.error.fg },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, minHeight: 60, paddingHorizontal: spacing.md },
    rowBordered: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border.subtle },
    name: { ...typography.body, fontFamily: FONT_FAMILY.medium, color: t.colors.text.primary, flex: 1 },
    invite: {
      minHeight: 36,
      paddingHorizontal: spacing.md,
      borderRadius: RADIUS.pill,
      justifyContent: "center",
      backgroundColor: t.colors.brand.soft,
    },
    inviteText: { ...typography.small, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    done: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36 },
    doneText: { ...typography.small, fontFamily: FONT_FAMILY.semibold, color: t.colors.status.success },
    dim: { opacity: 0.5 },
  });
