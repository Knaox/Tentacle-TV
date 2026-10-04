import { useTranslation } from "react-i18next";
import { SettingsSection } from "@/components/settings";
import { ProfileEntryRow } from "./ProfileEntryRow";
import { visibleGroups, type ProfileContext, type ProfileSection } from "./profileStructure";

/**
 * La page d'une rubrique : ses groupes, réduits à ce qui paraît dans ce
 * contexte — chaque groupe une carte, l'action destructive dans la sienne,
 * en dernier. La même sur téléphone (écran `/profile/<rubrique>`) et dans la
 * colonne de détail de la tablette.
 */
export function ProfileSectionBody({ section, ctx }: { section: ProfileSection; ctx: ProfileContext }) {
  const { t } = useTranslation();
  return (
    <>
      {visibleGroups(section, ctx).map((group, index) => (
        <SettingsSection key={index} title={group.title ? t(group.title.key, { ns: group.title.ns }) : undefined}>
          {group.entries.map((entry, i) => (
            <ProfileEntryRow key={`${entry.kind}:${entry.id}`} entry={entry} last={i === group.entries.length - 1} />
          ))}
        </SettingsSection>
      ))}
    </>
  );
}
