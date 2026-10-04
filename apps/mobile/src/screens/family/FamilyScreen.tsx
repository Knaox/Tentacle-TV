import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { familyErrorFromApi, useFamilyOverview } from "@tentacle-tv/api-client";
import type { FamilyOverviewDto } from "@tentacle-tv/shared";
import { DissolveSection, FamilyNotice, LeaveSection, MyPinSection } from "@/components/family/AccountSections";
import { FamilySection } from "@/components/family/FamilySection";
import { IncomingInvitationsSection } from "@/components/family/MembershipSections";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { Skeleton } from "@/components/ui";
import { familyScreenModel } from "@/family/familyScreenModel";
import { useFamilyAvailability } from "@/family/useFamilyAvailability";
import { useFamilyText } from "@/family/useFamilyText";
import { spacing, typography, useThemedStyles, type AppTheme } from "@/theme";
import { backOrHome } from "@/utils/backOrHome";
import { SettingsScaffold } from "../settings/SettingsScaffold";

/**
 * Profil › Compte › Famille — les mêmes gestes que le web et le bureau, sur
 * iPhone comme sur iPad (colonne centrée). v2 : UNE famille par compte,
 * partagée. Sans famille : les invitations reçues, ou créer la sienne. Dans
 * une famille : tous ses profils (un appui ouvre le panneau de ceux qu'on
 * gère), les gestes du rôle — le propriétaire invite, règle les droits,
 * retire, dissout ; un membre crée des invités si on le lui permet, et
 * quitte —, puis mon code PIN.
 *
 * Tout vient de `GET /api/family`, relu en direct par `family:update` (monté
 * par l'hôte de l'affiche, à la racine) : une réponse arrivée d'un autre
 * appareil remplit la page sans geste. Sans la Famille (serveur d'avant,
 * hors ligne), la page n'existe pas : un lien profond y ramène au profil.
 */
export function FamilyScreen() {
  const { t } = useTranslation(["familyWeb", "profile"]);
  const router = useRouter();
  const { available, settled } = useFamilyAvailability();
  const overview = useFamilyOverview({ enabled: available });
  const gone = (settled && !available) || overview.data === null;

  useEffect(() => {
    if (gone) backOrHome(router);
  }, [gone, router]);

  return (
    <SettingsScaffold title={t("profile:family")}>
      {overview.data ? (
        <FamilyContent overview={overview.data} />
      ) : overview.isError ? (
        familyErrorFromApi(overview.error)?.code === "family.personal_session_required"
          ? <FamilyNotice text={t("familyWeb:notice.personalOnly")} />
          : <LoadError error={overview.error} onRetry={() => void overview.refetch()} />
      ) : gone ? null : (
        <FamilySkeleton />
      )}
    </SettingsScaffold>
  );
}

function FamilyContent({ overview }: { overview: FamilyOverviewDto }) {
  const { t } = useTranslation("familyWeb");
  const st = useThemedStyles(makeStyles);
  const model = useMemo(() => familyScreenModel(overview), [overview]);
  return (
    <>
      <Text style={st.description}>{t("description")}</Text>
      {model.notices.map((key) => <FamilyNotice key={key} text={t(key)} />)}
      {model.showIncoming ? <IncomingInvitationsSection incoming={overview.incoming} /> : null}
      <FamilySection overview={overview} model={model} />
      {model.showMyPin ? <MyPinSection hasPin={overview.account.hasPin} /> : null}
      {model.showLeave && overview.family ? <LeaveSection familyId={overview.family.id} ownerName={overview.family.owner.name} /> : null}
      {model.showDissolve ? <DissolveSection /> : null}
    </>
  );
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  return (
    <SettingsSection title={t("loadError")} caption={errorText(error)}>
      <SettingsRow icon="refresh-cw" label={t("retry")} accent last onPress={onRetry} />
    </SettingsSection>
  );
}

/** La place des sections, le temps de la première lecture : rien ne saute à l'arrivée. */
function FamilySkeleton() {
  const st = useThemedStyles(makeStyles);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={st.skeleton}>
      <Skeleton width="80%" height={16} />
      <Skeleton width="100%" height={180} radius={12} />
      <Skeleton width="100%" height={64} radius={12} />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    description: { ...typography.body, color: t.colors.text.tertiary, lineHeight: 21, marginBottom: spacing.lg },
    skeleton: { gap: spacing.lg },
  });
