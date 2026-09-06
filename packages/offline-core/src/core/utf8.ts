/**
 * UTF-8 sans `Buffer`, et sans `TextDecoder` garanti.
 *
 * Le cœur tourne aussi sur Hermes (React Native), où `Buffer` n'existe pas et
 * où `TextDecoder` n'est pas promis. Quand le moteur JavaScript en fournit un,
 * on s'en sert ; sinon un décodeur pur prend le relais, avec le caractère de
 * remplacement U+FFFD sur les séquences invalides — la politique par défaut de
 * `TextDecoder`, à ceci près qu'une séquence invalide n'avale qu'un octet.
 */

interface Decoder {
  decode(bytes: Uint8Array): string;
}

interface Encoder {
  encode(text: string): Uint8Array;
}

type DecoderCtor = new (label: string) => Decoder;
type EncoderCtor = new () => Encoder;

function nativeDecoder(): Decoder | null {
  const ctor = (globalThis as { TextDecoder?: DecoderCtor }).TextDecoder;
  return typeof ctor === "function" ? new ctor("utf-8") : null;
}

function nativeEncoder(): Encoder | null {
  const ctor = (globalThis as { TextEncoder?: EncoderCtor }).TextEncoder;
  return typeof ctor === "function" ? new ctor() : null;
}

const decoder = nativeDecoder();
const encoder = nativeEncoder();

/** Octets UTF-8 → texte. */
export function decodeUtf8(bytes: Uint8Array): string {
  return decoder === null ? decodePure(bytes) : decoder.decode(bytes);
}

/** Texte → octets UTF-8. */
export function encodeUtf8(text: string): Uint8Array {
  return encoder === null ? encodePure(text) : encoder.encode(text);
}

/** Unités de code accumulées, vidées par paquets : `fromCharCode` a une limite d'arguments. */
const FLUSH_AT = 8_192;

function decodePure(bytes: Uint8Array): string {
  const parts: string[] = [];
  let units: number[] = [];
  const flush = (): void => {
    if (units.length === 0) return;
    parts.push(String.fromCharCode(...units));
    units = [];
  };
  const n = bytes.length;
  let i = 0;
  while (i < n) {
    const b0 = bytes[i] ?? 0;
    if (b0 < 0x80) {
      units.push(b0);
      i += 1;
    } else {
      let need = 0;
      let code = 0;
      let min = 0;
      if (b0 >= 0xc2 && b0 <= 0xdf) {
        need = 1;
        code = b0 & 0x1f;
        min = 0x80;
      } else if (b0 >= 0xe0 && b0 <= 0xef) {
        need = 2;
        code = b0 & 0x0f;
        min = 0x800;
      } else if (b0 >= 0xf0 && b0 <= 0xf4) {
        need = 3;
        code = b0 & 0x07;
        min = 0x10000;
      }
      let ok = need > 0 && i + need < n;
      for (let k = 1; ok && k <= need; k += 1) {
        const b = bytes[i + k] ?? 0;
        if ((b & 0xc0) !== 0x80) ok = false;
        else code = (code << 6) | (b & 0x3f);
      }
      const surrogate = code >= 0xd800 && code <= 0xdfff;
      if (!ok || code < min || code > 0x10ffff || surrogate) {
        units.push(0xfffd);
        i += 1;
      } else {
        if (code >= 0x10000) {
          const offset = code - 0x10000;
          units.push(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
        } else {
          units.push(code);
        }
        i += need + 1;
      }
    }
    if (units.length >= FLUSH_AT) flush();
  }
  flush();
  return parts.join("");
}

function encodePure(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0xfffd;
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(out);
}
