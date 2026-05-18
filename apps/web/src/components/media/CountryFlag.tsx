import {
  BR,
  CA,
  CN,
  DE,
  DK,
  ES,
  FI,
  FR,
  IN,
  IT,
  JP,
  KR,
  NL,
  NO,
  PL,
  RU,
  SA,
  SE,
  TR,
  US,
} from "country-flag-icons/react/3x2";

const FLAG_BY_CODE = {
  BR, CA, CN, DE, DK, ES, FI, FR, IN, IT, JP, KR, NL, NO, PL, RU, SA, SE, TR, US,
} as const;

type FlagCode = keyof typeof FLAG_BY_CODE;

interface Props {
  /** Code primaire ISO 3166-1 alpha-2 (ex. "FR", "US"). */
  code: string;
  /** Code secondaire optionnel — affiché à droite (ex. "CA" pour VFQ). */
  secondary?: string;
  /** Code langue d'origine — utilisé pour l'aria-label si fourni. */
  languageCode?: string;
}

/**
 * Drapeau pays rendu en SVG (ratio 3:2) — cohérent macOS/Windows/Linux.
 * Sur Windows, Segoe UI Emoji ne contient pas les regional indicators
 * drapeaux, donc l'emoji `🇫🇷` s'affichait en lettres "FR" — d'où ce
 * composant qui contourne le problème en inline SVG.
 *
 * Si le code n'est pas dans la map, fallback texte (initiales encadrées)
 * pour ne jamais casser le rendu sur un pays exotique.
 */
export function CountryFlag({ code, secondary, languageCode }: Props) {
  const labelBase = languageCode?.toUpperCase() ?? code;
  const label = secondary ? `${labelBase} (Canadien)` : labelBase;
  return (
    <span
      aria-label={`Audio : ${label}`}
      className="inline-flex h-[18px] items-center justify-center gap-[2px] rounded-[3px] px-[3px] leading-none"
      style={{
        background: "rgba(0,0,0,0.55)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.18) inset",
      }}
    >
      <FlagGlyph code={code} />
      {secondary && <FlagGlyph code={secondary} />}
    </span>
  );
}

function FlagGlyph({ code }: { code: string }) {
  const upper = code.toUpperCase();
  const Flag = (FLAG_BY_CODE as Record<string, (typeof FLAG_BY_CODE)[FlagCode] | undefined>)[upper];
  if (Flag) {
    return (
      <Flag
        aria-hidden
        className="h-[12px] w-auto rounded-[1px]"
        style={{ display: "block" }}
      />
    );
  }
  return (
    <span aria-hidden className="text-[9px] font-bold tracking-wider text-white/90">
      {upper}
    </span>
  );
}
