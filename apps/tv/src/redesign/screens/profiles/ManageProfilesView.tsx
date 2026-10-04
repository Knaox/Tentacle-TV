import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { MANAGE_BACK_BAR_KEY, MANAGE_BACK_KEY } from "@tentacle-tv/tv-core";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BACK_BUTTON_SIZE, BACK_TOP, BackButton } from "../../controls/BackButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { text } from "../../theme/tokens";
import { StatusPanel } from "../shared/StatusPanel";
import { GuestForm } from "./GuestForm";
import { InviteMember } from "./InviteMember";
import { ManageList } from "./ManageList";
import type { ManageProfilesViewProps } from "./manageTypes";
import { PinPad } from "./PinPad";
import { PROFILES_PALETTE } from "./profileColors";

export type { InviteCandidateView, ManageNotice, ManageProfilesViewProps, ManageRowView, ManageViewModel } from "./manageTypes";

/**
 * « Gérer les profils » (`ManageProfiles`, Apple TV, profil du propriétaire) :
 * la liste de la famille et ses deux pages — créer un invité, inviter un
 * membre —, ou le pavé du PIN du propriétaire quand la gestion est à rouvrir.
 * La croix Retour, en haut à gauche comme partout, recule d'une page ; depuis
 * la liste, elle sort (`manageBackAction`, tv-core).
 *
 * Clés : `manage:back` et sa bande `manage:top` ; celles de `ManageList`,
 * `GuestForm`, `InviteMember`, `PinPad` ; `status:primary`.
 */
export const ManageProfilesView = memo(function ManageProfilesView(props: ManageProfilesViewProps) {
  const { model } = props;
  const { t } = useTranslation(["familyTv", "common"]);
  const title =
    model.kind === "guest" ? t("familyTv:guest.title") : model.kind === "invite" ? t("familyTv:invite.title") : t("familyTv:manage.title");
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={PROFILES_PALETTE} intensity={1.1} />
      <Animated.View key={model.kind} entering={FadeIn.duration(240)} style={styles.fill}>
        {model.kind === "loading" ? <StatusPanel kind="loading" title={t("familyTv:manage.title")} inset={0} /> : null}
        {model.kind === "error" ? (
          <StatusPanel
            kind="error"
            title={t("familyTv:manage.loadFailed")}
            message={model.message}
            inset={0}
            primary={{ label: t("common:retry"), icon: "refresh", onPress: props.onRetry }}
          />
        ) : null}
        {model.kind === "pin" ? (
          <View style={styles.center}>
            <PinPad pad={model.pad} onDigit={props.onDigit} onErase={props.onErase} />
          </View>
        ) : null}
        {model.kind === "list" || model.kind === "guest" || model.kind === "invite" ? (
          <View style={styles.page}>
            <Text style={styles.title}>{title}</Text>
            {model.kind === "list" ? <Text style={styles.subtitle}>{model.subtitle}</Text> : null}
            <View style={styles.body}>
              {model.kind === "list" ? (
                <ManageList
                  rows={model.rows}
                  canCreateGuest={model.canCreateGuest}
                  canInvite={model.canInvite}
                  blocked={model.blocked}
                  armedId={model.armedId}
                  notice={model.notice}
                  onCreateGuest={props.onCreateGuest}
                  onInvite={props.onInvite}
                  onRowAction={props.onRowAction}
                  onRowBlur={props.onRowBlur}
                />
              ) : null}
              {model.kind === "guest" ? (
                <GuestForm
                  name={model.name}
                  color={model.color}
                  creating={model.creating}
                  error={model.error}
                  onName={props.onGuestName}
                  onColor={props.onGuestColor}
                  onSubmit={props.onGuestSubmit}
                />
              ) : null}
              {model.kind === "invite" ? (
                <InviteMember
                  query={model.query}
                  candidates={model.candidates}
                  more={model.more}
                  notice={model.notice}
                  onQuery={props.onQuery}
                  onSearch={props.onSearch}
                  onInvite={props.onInviteCandidate}
                />
              ) : null}
            </View>
          </View>
        ) : null}
        {model.kind !== "loading" ? (
          <FocusGroup focusKey={MANAGE_BACK_BAR_KEY} style={styles.backBar}>
            <BackButton focusKey={MANAGE_BACK_KEY} onPress={props.onBack} />
          </FocusGroup>
        ) : null}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { flex: 1, paddingTop: BACK_TOP + BACK_BUTTON_SIZE + 34, paddingHorizontal: TV_STAGE.safe.x + 40 },
  title: { ...text.title },
  subtitle: { ...text.meta, marginTop: 10 },
  body: { marginTop: 40 },
  backBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BACK_TOP + BACK_BUTTON_SIZE,
    paddingTop: BACK_TOP,
    paddingLeft: TV_STAGE.safe.x,
    flexDirection: "row",
    alignItems: "flex-start",
  },
});
