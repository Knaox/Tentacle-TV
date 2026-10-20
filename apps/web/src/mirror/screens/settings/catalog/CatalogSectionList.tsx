import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  settingsSectionSummary, settingsSectionTarget, visibleSettingsSections,
  type SettingsCatalogContext, type SettingsCatalogSection, type SettingsSectionId,
} from "@tentacle-tv/shared";
import { useThemeMode } from "../../../../theme/useThemeMode";
import { SettingsRow } from "../ui/SettingsRow";
import { SettingsSection } from "../ui/SettingsSection";
import { catalogIcon } from "./catalogIcons";
import { isWebPane, webPaneRoute, webSectionRoute } from "./webCatalog";

const THEME_KEYS = { light: "themeLight", dark: "themeDark", auto: "themeAuto" } as const;

/**
 * Les rubriques du catalogue partagé, une carte — `ProfileSectionList` du
 * mobile : pictogramme, nom, et dessous ce qu'on y trouve ; pour « Lecture
 * et apparence », ce qui est réglé (« Sombre · Français »). Téléphone : la
 * ligne ouvre la page de la rubrique (ou son volet unique, « TV et
 * appareils ») ; tablette : elle la pose dans la colonne de droite.
 */
export function CatalogSectionList({ ctx, selected, onSelect }: {
  ctx: SettingsCatalogContext;
  selected?: SettingsSectionId | null;
  onSelect?: (id: SettingsSectionId) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const sections = visibleSettingsSections(ctx);
  const appearance = `${t(THEME_KEYS[mode], { ns: "preferences" })} · ${i18n.language?.startsWith("fr") ? "Français" : "English"}`;

  const open = (section: SettingsCatalogSection) => {
    if (onSelect) return onSelect(section.id);
    const target = settingsSectionTarget(section, ctx);
    navigate(target.kind === "pane" && isWebPane(target.id) ? webPaneRoute(target.id) : webSectionRoute(section.id));
  };

  return (
    <SettingsSection>
      {sections.map((section, index) => {
        const summary = settingsSectionSummary(section, ctx);
        const caption = section.id === "playback" ? appearance : summary ? t(summary.key, { ns: summary.ns }) : undefined;
        return (
          <SettingsRow
            key={section.id}
            icon={catalogIcon(section.icon)}
            label={t(section.label.key, { ns: section.label.ns })}
            description={caption}
            chevron={!onSelect}
            selected={onSelect ? selected === section.id : undefined}
            last={index === sections.length - 1}
            onPress={() => open(section)}
          />
        );
      })}
    </SettingsSection>
  );
}
