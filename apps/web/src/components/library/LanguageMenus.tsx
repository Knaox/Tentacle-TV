import { useTranslation } from "react-i18next";
import type { LanguageOption, LibraryLanguages } from "@tentacle-tv/api-client";
import { languageName } from "@tentacle-tv/shared";
import { FilterMenu } from "./FilterMenu";
import { CheckRow } from "./LibraryFilterMenus";
import type { LibraryFilterState } from "../../hooks/useLibraryFilters";

/**
 * Filtrer une bibliothèque par langue audio ou de sous-titres — nouveauté de
 * Jellyfin 12. Un choix par menu (recliquer la langue choisie la retire) :
 * « les films en VF », « les séries sous-titrées en anglais ». Absents quand le
 * serveur ne sait pas filtrer par langue (`languages` nul) ou n'a rien.
 */
export function LanguageMenus({ languages, filters, onAudioLangChange, onSubtitleLangChange }: {
  languages: LibraryLanguages | null | undefined;
  filters: LibraryFilterState;
  onAudioLangChange?: (code: string | null) => void;
  onSubtitleLangChange?: (code: string | null) => void;
}) {
  if (!languages) return null;
  return (
    <>
      {onAudioLangChange && (
        <OneLanguageMenu labelKey="filterAudioLanguage" options={languages.audio} value={filters.audioLang} onChange={onAudioLangChange} />
      )}
      {onSubtitleLangChange && (
        <OneLanguageMenu labelKey="filterSubtitleLanguage" options={languages.subtitle} value={filters.subtitleLang} onChange={onSubtitleLangChange} />
      )}
    </>
  );
}

function OneLanguageMenu({ labelKey, options, value, onChange }: {
  labelKey: "filterAudioLanguage" | "filterSubtitleLanguage";
  options: LanguageOption[];
  value: string | null;
  onChange: (code: string | null) => void;
}) {
  const { t, i18n } = useTranslation("common");
  if (options.length === 0) return null;
  const name = (code: string) => languageName(code, i18n.language);
  return (
    <FilterMenu label={t(`common:${labelKey}`)} value={value ? name(value) : null} onClear={() => onChange(null)} width={220}>
      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto" role="menu">
        {options.map((o) => (
          <CheckRow key={o.code} label={name(o.code)} checked={value === o.code} onClick={() => onChange(value === o.code ? null : o.code)} />
        ))}
      </div>
    </FilterMenu>
  );
}
