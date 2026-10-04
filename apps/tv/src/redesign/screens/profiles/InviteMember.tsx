import { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { INVITE_RESULTS_GROUP, INVITE_SEARCH_KEY, inviteCandidateKey } from "@tentacle-tv/tv-core";
import { Chip } from "../../controls/Chip";
import { FocusGroup } from "../../focus/FocusGroup";
import { colors, fonts, text, white } from "../../theme/tokens";
import { PairingField } from "../pairing/PairingField";
import type { InviteCandidateView, ManageNotice } from "./manageTypes";
import { ProfileAvatar } from "./ProfileAvatar";

/**
 * Inviter un membre : les comptes que l'écran de connexion de Jellyfin montre,
 * filtrés par la recherche (OK sur le champ : le clavier de l'Apple TV) ; un
 * compte masqué ne paraît que par son nom EXACT — le serveur seul en décide.
 * « Inviter » envoie ; la personne accepte sur son propre appareil, jamais ici.
 *
 * Clés : `invite:search`, `invite:candidate:<i>` ; groupe `invite:results`.
 */
export const InviteMember = memo(function InviteMember({ query, candidates, more, notice, onQuery, onSearch, onInvite }: {
  query: string;
  candidates: InviteCandidateView[] | null;
  more: boolean;
  notice: ManageNotice | null;
  onQuery?: (query: string) => void;
  onSearch?: () => void;
  onInvite?: (id: string) => void;
}) {
  const { t } = useTranslation("familyTv");
  return (
    <View>
      <Text style={styles.explain}>{t("invite.explain")}</Text>
      <PairingField
        focusKey={INVITE_SEARCH_KEY}
        icon="search"
        label={t("invite.searchLabel")}
        caption
        value={query}
        placeholder={t("invite.searchPlaceholder")}
        keyboard={{ returnKeyType: "search", textContentType: "username", autoComplete: "off" }}
        onChangeText={onQuery}
        onSubmitEditing={onSearch}
      />
      <Text style={styles.hidden}>{t("invite.hiddenHint")}</Text>
      {candidates === null ? (
        <ActivityIndicator size="large" color={colors.text} style={styles.spinner} />
      ) : candidates.length === 0 ? (
        <Text style={styles.empty}>{query.trim() ? t("invite.noMatch") : t("invite.none")}</Text>
      ) : (
        <FocusGroup focusKey={INVITE_RESULTS_GROUP} style={styles.results}>
          {candidates.map((candidate, index) => (
            <View key={candidate.id} style={styles.row}>
              <ProfileAvatar name={candidate.name} color={null} uri={candidate.avatarUri} size={68} />
              <Text style={styles.name} numberOfLines={1}>{candidate.name}</Text>
              <Chip
                label={candidate.sent ? t("invite.sent", { name: candidate.name }) : t("invite.invite")}
                icon={candidate.sent ? "check" : "plus"}
                selected={candidate.sent}
                size="md"
                focusKey={inviteCandidateKey(index)}
                onPress={candidate.sent || !onInvite ? undefined : () => onInvite(candidate.id)}
              />
            </View>
          ))}
        </FocusGroup>
      )}
      {more ? <Text style={styles.more}>{t("invite.more")}</Text> : null}
      <Text style={[styles.notice, { color: notice?.tone === "error" ? colors.warningFg : colors.successFg }]}>{notice?.text ?? " "}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  explain: { ...text.body, maxWidth: 1100, marginBottom: 34 },
  hidden: { ...text.caption, marginTop: 14, marginLeft: 8 },
  spinner: { marginTop: 48, alignSelf: "flex-start" },
  empty: { ...text.body, marginTop: 40 },
  results: { marginTop: 30, gap: 8, maxWidth: 1300 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 26,
    minHeight: 84,
    borderBottomWidth: 1,
    borderColor: white(0.08),
  },
  name: { ...text.rowTitle, flex: 1 },
  more: { ...text.caption, marginTop: 16 },
  notice: { ...fonts.semibold, fontSize: 26, lineHeight: 34, marginTop: 22 },
});
