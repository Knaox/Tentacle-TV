import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFamilyLibraries, useServerCapability } from "@tentacle-tv/api-client";
import { familyRightsSummary, type FamilyProfileDto, type RightsSummaryKind } from "@tentacle-tv/shared";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { RIGHTS_SUMMARY_ICONS, readsProfileLibraries } from "./rightsSummaryIcons";

/**
 * Les droits d'un profil, EN LECTURE SEULE — décision de Damien (20/10) : ils
 * se règlent au bureau ou sur le web, s'appliquent partout. Le résumé vient du
 * modèle partagé (`familyRightsSummary`), les bibliothèques sont lues à la
 * demande pour un profil que ce compte peut régler. Puis « Modifier sur le
 * bureau ou le web ». Un droit changé ailleurs s'y voit aussitôt
 * (`family:update`, `rights:changed`).
 */
export function ProfileRightsSummary({ profile, omit = [] }: {
  profile: FamilyProfileDto;
  /** Ce que l'écran règle déjà au-dessus (`editedSummaryKinds`) : le reste seul, sous « Autres droits ». */
  omit?: readonly RightsSummaryKind[];
}) {
  const { t } = useTranslation("familyRightsSummary");
  const capable = useServerCapability("family.libraryLimits");
  const reads = readsProfileLibraries({ capable, parentalShown: profile.parental !== undefined });
  const libraries = useFamilyLibraries(profile.userId, { enabled: reads });
  const summary = useMemo(
    () => familyRightsSummary({ profile, libraries: reads ? libraries.data ?? null : null }),
    [profile, reads, libraries.data],
  );
  const partial = omit.length > 0;
  const lines = summary.lines.filter((line) => !omit.includes(line.kind));
  if (lines.length === 0 && !partial) return null;

  return (
    <SettingsSection
      title={t(partial ? "otherTitle" : "title")}
      caption={partial ? t("moreHint") : summary.editElsewhere ? t("editHint") : undefined}
    >
      {lines.map((line) => (
        <SettingsRow key={`${line.kind}:${line.key}`} icon={RIGHTS_SUMMARY_ICONS[line.kind]} label={t(line.key, line.params)} />
      ))}
      {reads && libraries.isLoading && !omit.includes("libraries") ? <SettingsRow icon="folder" label={t("loading")} /> : null}
      {partial || summary.editElsewhere
        ? <SettingsRow icon="monitor" label={t(partial ? "moreElsewhere" : "editElsewhere")} accent last />
        : null}
    </SettingsSection>
  );
}
