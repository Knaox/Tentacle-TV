import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { SettingsSection } from "@/components/settings";
import { ProfileEntryRow } from "./ProfileEntryRow";
import { visibleSettingsGroups, type SettingsCatalogContext, type SettingsCatalogGroup, type SettingsCatalogSection } from "@tentacle-tv/shared";

/** Un groupe de blocs se pose tel quel : ses blocs ont leurs propres cartes (ou n'en veulent pas). */
const isBlockGroup = (group: SettingsCatalogGroup): boolean => group.entries.every((entry) => entry.kind === "block");

/**
 * La page d'une rubrique : ses groupes, réduits à ce qui paraît dans ce
 * contexte — chaque groupe une carte (titre, puis phrase dessous), l'action
 * destructive dans la sienne, en dernier. La même sur téléphone (écran
 * `/profile/<rubrique>`) et dans la colonne de détail de la tablette.
 */
export function ProfileSectionBody({ section, ctx }: { section: SettingsCatalogSection; ctx: SettingsCatalogContext }) {
  const { t } = useTranslation();
  return (
    <>
      {visibleSettingsGroups(section, ctx).map((group, index) => {
        const rows = group.entries.map((entry, i) => (
          <ProfileEntryRow key={`${entry.kind}:${entry.id}`} entry={entry} last={i === group.entries.length - 1} />
        ));
        if (isBlockGroup(group)) return <Fragment key={index}>{rows}</Fragment>;
        return (
          <SettingsSection
            key={index}
            title={group.title ? t(group.title.key, { ns: group.title.ns }) : undefined}
            caption={group.caption ? t(group.caption.key, { ns: group.caption.ns }) : undefined}
          >
            {rows}
          </SettingsSection>
        );
      })}
    </>
  );
}

