import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { SettingsRow, SettingsSection, THEME_MODE_LABEL_KEYS, type SettingsIcon } from "@/components/settings";
import { useThemeMode } from "@/theme";
import { PROFILE_PANE_ROUTES } from "./profilePanes";
import {
  settingsSectionSummary, settingsSectionTarget, visibleSettingsSections,
  type SettingsCatalogContext, type SettingsCatalogSection, type SettingsSectionId,
} from "@tentacle-tv/shared";

interface Props {
  ctx: SettingsCatalogContext;
  /** Tablette : la rubrique affichée à droite, et le choix d'une autre. */
  selected?: SettingsSectionId | null;
  onSelect?: (id: SettingsSectionId) => void;
}

/**
 * Les rubriques du profil, une carte : pictogramme, nom et, dessous, ce
 * qu'on y trouve — ou, pour « Lecture et apparence », ce qui est réglé
 * (« Sombre · Français ») : on lit l'état sans ouvrir, comme les onglets des réglages de
 * l'Apple TV. Téléphone : la ligne ouvre la page de la rubrique ; tablette :
 * elle la pose dans la colonne de droite.
 */
export function ProfileSectionList({ ctx, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const sections = visibleSettingsSections(ctx);
  const appearance = useAppearanceCaption();

  const open = (section: SettingsCatalogSection) => {
    if (onSelect) return onSelect(section.id);
    const target = settingsSectionTarget(section, ctx);
    router.push((target.kind === "pane" ? PROFILE_PANE_ROUTES[target.id] : `/profile/${section.id}`) as Href);
  };

  return (
    <SettingsSection>
      {sections.map((section, index) => {
        const summary = settingsSectionSummary(section, ctx);
        const caption = section.id === "playback" ? appearance : summary ? t(summary.key, { ns: summary.ns }) : undefined;
        return (
          <SettingsRow
            key={section.id}
            icon={section.icon as SettingsIcon}
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

/** « Sombre · Français » : le thème et la langue en cours. */
function useAppearanceCaption(): string {
  const { t, i18n } = useTranslation();
  const { mode } = useThemeMode();
  const language = i18n.language?.startsWith("fr") ? "Français" : "English";
  return `${t(THEME_MODE_LABEL_KEYS[mode], { ns: "preferences" })} · ${language}`;
}
