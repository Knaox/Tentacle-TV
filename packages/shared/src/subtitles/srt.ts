/**
 * SRT → WebVTT, sans perte : un fichier SubRip n'a ni style ni position à
 * conserver, seule sa syntaxe diffère (virgule des millisecondes, pas
 * d'en-tête). Sert à l'overlay du lecteur système quand un sous-titre externe
 * est gardé dans son format d'origine sur l'appareil.
 */
export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      // « 00:01:02,500 --> 00:01:04,000 » : la virgule devient un point, des deux côtés.
      /^\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(line)
        ? line.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, "$1.$2")
        : line,
    )
    .join("\n");
  return `WEBVTT\n\n${body.trim()}\n`;
}
