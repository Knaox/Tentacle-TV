import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { SettingsRow, SettingsSection, THEME_MODE_LABEL_KEYS, type SettingsIcon } from "@/components/settings";
import { useThemeMode } from "@/theme";
import { PROFILE_PANE_ROUTES } from "./profilePanes";
import {
  sectionSummary, sectionTarget, visibleSections,
  type ProfileContext, type ProfileSection, type ProfileSectionId,
} from "./profileStructure";

interface Props {
  ctx: ProfileContext;
  /** Tablette : la rubrique affichée à droite, et le choix d'une autre. */
  selected?: ProfileSectionId | null;
  onSelect?: (id: ProfileSectionId) => void;
}

/**
 * Les rubriques du profil, une carte : pictogramme, nom et, dessous, ce
 * qu'on y trouve — ou, pour l'Apparence, ce qui est réglé (« Sombre ·
 * Français ») : on lit l'état sans ouvrir, comme les onglets des réglages de
 * l'Apple TV. Téléphone : la ligne ouvre la page de la rubrique ; tablette :
 * elle la pose dans la colonne de droite.
 */
export function ProfileSectionList({ ctx, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const sections = visibleSections(ctx);
  const appearance = useAppearanceCaption();

  const open = (section: ProfileSection) => {
    if (onSelect) return onSelect(section.id);
    const target = sectionTarget(section, ctx);
    router.push((target.kind === "pane" ? PROFILE_PANE_ROUTES[target.id] : `/profile/${section.id}`) as Href);
  };

  return (
    <SettingsSection>
      {sections.map((section, index) => {
        const summary = sectionSummary(section, ctx);
        const caption = section.id === "appearance" ? appearance : summary ? t(summary.key, { ns: summary.ns }) : undefined;
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
