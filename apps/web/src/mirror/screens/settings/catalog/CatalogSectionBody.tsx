import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  visibleSettingsGroups, type SettingsCatalogContext, type SettingsCatalogSection, type SettingsCatalogGroup, type SettingsI18nRef,
} from "@tentacle-tv/shared";
import { SettingsSection } from "../ui/SettingsSection";
import { CatalogEntryRow } from "./CatalogEntryRow";
import { webText } from "./webCatalog";

/** Un groupe de blocs se pose tel quel : ses blocs ont leurs propres cartes (ou n'en veulent pas). */
const isBlockGroup = (group: SettingsCatalogGroup): boolean => group.entries.every((entry) => entry.kind === "block");

/**
 * La page d'une rubrique du catalogue partagé — `ProfileSectionBody` du
 * mobile : ses groupes réduits à ce qui paraît ici, chaque groupe une carte
 * (titre, puis phrase dessous). La même sur téléphone (`/profile/<rubrique>`)
 * et dans la colonne de détail de la tablette.
 */
export function CatalogSectionBody({ section, ctx }: { section: SettingsCatalogSection; ctx: SettingsCatalogContext }) {
  const { t } = useTranslation();
  const text = (ref: SettingsI18nRef | undefined) => {
    if (!ref) return undefined;
    const resolved = webText(ref);
    return t(resolved.key, { ns: resolved.ns });
  };
  return (
    <>
      {visibleSettingsGroups(section, ctx).map((group, index) => {
        const rows = group.entries.map((entry, i) => (
          <CatalogEntryRow key={`${entry.kind}:${entry.id}`} entry={entry} last={i === group.entries.length - 1} />
        ));
        if (isBlockGroup(group)) return <Fragment key={index}>{rows}</Fragment>;
        return (
          <SettingsSection key={index} title={text(group.title)} caption={text(group.caption)}>
            {rows}
          </SettingsSection>
        );
      })}
    </>
  );
}
