import { countries } from "country-flag-icons";
import { searchScore } from "@tentacle-tv/shared";

/** Un pays du sélecteur de région. */
export interface CountryOption {
  code: string;
  /** Nom dans la langue de l'interface ; le code si le navigateur ne le connaît pas. */
  name: string;
  /** Nom anglais : « germany » trouve l'Allemagne dans une interface française. */
  englishName: string;
  /** Plateformes que TMDB y référence — null quand la couverture est inconnue. */
  providers: number | null;
}

export interface ProviderRegionLike {
  code: string;
  providers: number;
}

const REGION_CODE = /^[A-Z]{2}$/;
/** Des codes de la bibliothèque de drapeaux qui ne sont pas des pays. */
const NOT_COUNTRIES: ReadonlySet<string> = new Set(["EU"]);

function regionNamer(locale: string): (code: string) => string {
  try {
    const names = new Intl.DisplayNames([locale], { type: "region", fallback: "code" });
    return (code) => names.of(code) ?? code;
  } catch {
    return (code) => code;
  }
}

function collatorFor(locale: string): Intl.Collator {
  try {
    return new Intl.Collator(locale);
  } catch {
    return new Intl.Collator();
  }
}

/**
 * La liste du sélecteur. Couverture connue (pays renvoyés par le serveur) :
 * ces pays-là seulement — un pays sans plateforme n'afficherait rien.
 * Inconnue (pas encore de clé, serveur d'avant la liste) : tous les pays. La
 * région enregistrée y figure toujours, couverte ou non, pour que le
 * sélecteur ne mente pas sur l'état. Triée par nom, dans la langue de
 * l'interface.
 */
export function buildCountryOptions(
  regions: readonly ProviderRegionLike[] | undefined,
  locale: string,
  current: string,
): CountryOption[] {
  const local = regionNamer(locale);
  const english = regionNamer("en");
  const known = regions && regions.length > 0 ? new Map(regions.map((r) => [r.code, r.providers])) : null;
  const codes = known ? [...known.keys()] : countries.filter((c) => REGION_CODE.test(c) && !NOT_COUNTRIES.has(c));
  if (REGION_CODE.test(current) && !codes.includes(current)) codes.push(current);
  const collator = collatorFor(locale);
  return codes
    .map((code) => ({
      code,
      name: local(code),
      englishName: english(code),
      providers: known ? (known.get(code) ?? 0) : null,
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * La recherche du sélecteur : le code exact d'abord (« de », « us »), puis
 * le meilleur score sur le nom local ou anglais — accents, casse et
 * ponctuation ignorés, comme partout ailleurs (`searchScore`). À score égal,
 * l'ordre alphabétique de la liste est gardé.
 */
export function filterCountryOptions(options: readonly CountryOption[], query: string): CountryOption[] {
  const q = query.trim();
  if (!q) return [...options];
  const code = q.toUpperCase();
  return options
    .map((option) => ({
      option,
      score: option.code === code ? Number.MAX_SAFE_INTEGER : Math.max(searchScore(option.name, q), searchScore(option.englishName, q)),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.option);
}
