/** L'analyse des libellés de pistes Jellyfin (« French - AAC »), partagée par les deux habillages du sélecteur. */

/** Extract language, codec, and title from track label like "French - AAC" */
export function parseTrackLabel(raw: string) {
  const parts = raw.split(" - ");
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();
    const isCodec = /^[A-Z0-9]{2,8}$/i.test(last);
    return {
      title: parts.slice(0, isCodec ? -1 : undefined).join(" - "),
      codec: isCodec ? last : null,
      lang: extractLang(parts[0]),
    };
  }
  return { title: raw, codec: null, lang: extractLang(raw) };
}

const LANG_MAP: Record<string, string> = {
  french: "FR", français: "FR", francais: "FR", fre: "FR", fra: "FR",
  english: "EN", anglais: "EN", eng: "EN",
  japanese: "JP", japonais: "JP", jpn: "JP",
  german: "DE", allemand: "DE", ger: "DE", deu: "DE",
  spanish: "ES", espagnol: "ES", spa: "ES",
  undetermined: "", und: "",
};

function extractLang(text: string): string | null {
  const lower = text.toLowerCase().trim();
  for (const [key, code] of Object.entries(LANG_MAP)) {
    if (lower.includes(key)) return code || null;
  }
  return null;
}
