import { useTranslation } from "react-i18next";
import { useLibraryLanguages, type LanguageOption } from "@tentacle-tv/api-client";
import { languageName } from "@tentacle-tv/shared";
import { languageDisplayName } from "@tentacle-tv/offline-core";
import { FilterChip, FilterSection } from "@/components/filters/FilterChip";

interface Props {
  libraryId: string;
  audioLang: string | null;
  subtitleLang: string | null;
  onAudioLangChange: (code: string | null) => void;
  onSubtitleLangChange: (code: string | null) => void;
}

/**
 * Filtrer par langue audio ou de sous-titres — nouveauté de Jellyfin 12 :
 * « les films en VF », « les séries sous-titrées en anglais ». Une langue par
 * section (retoucher la choisie la retire). Rien quand le serveur ne sait pas
 * filtrer par langue : un Jellyfin 10.x ignorerait le paramètre et rendrait
 * tout — la détection passe par `/Items/Filters2` (`useLibraryLanguages`).
 */
export function LanguageFilterSections({ libraryId, audioLang, subtitleLang, onAudioLangChange, onSubtitleLangChange }: Props) {
  const { data: languages } = useLibraryLanguages(libraryId);
  if (!languages) return null;
  return (
    <>
      <OneLanguage titleKey="filterAudioLanguage" options={languages.audio} value={audioLang} onChange={onAudioLangChange} />
      <OneLanguage titleKey="filterSubtitleLanguage" options={languages.subtitle} value={subtitleLang} onChange={onSubtitleLangChange} />
    </>
  );
}

function OneLanguage({ titleKey, options, value, onChange }: {
  titleKey: "filterAudioLanguage" | "filterSubtitleLanguage";
  options: LanguageOption[];
  value: string | null;
  onChange: (code: string | null) => void;
}) {
  const { t, i18n } = useTranslation("common");
  if (options.length === 0) return null;
  // Hermes n'a pas `Intl.DisplayNames` : la table d'offline-core d'abord.
  const name = (code: string) => languageDisplayName(code, i18n.language) ?? languageName(code, i18n.language);
  return (
    <FilterSection title={t(titleKey)}>
      <FilterChip label={t("allFilter")} active={value === null} onPress={() => onChange(null)} />
      {options.map((o) => (
        <FilterChip key={o.code} label={name(o.code)} active={value === o.code} onPress={() => onChange(value === o.code ? null : o.code)} />
      ))}
    </FilterSection>
  );
}
