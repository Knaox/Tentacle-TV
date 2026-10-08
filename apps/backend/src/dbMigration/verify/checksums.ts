import { createHash } from "crypto";

/**
 * Sommes de contrôle NORMALISÉES, indépendantes de l'ordre des lignes.
 *
 * Chaque cellule passe par une forme canonique — `null`, entier (nombre ou
 * BigInt, même écriture), réel, texte exact, octets — puis une empreinte de
 * 64 bits ; la somme d'une colonne est la somme modulo 2⁶⁴ de ses cellules. Les
 * dates sont comparées en millisecondes (déjà converties) et les booléens en 0/1 :
 * ce que la copie a voulu écrire se compare à ce que SQLite rend, sans dépendre
 * de l'ordre de lecture. Le texte est comparé EXACT : la copie ne touche pas à
 * la casse (MariaDB la garde telle qu'écrite, seule sa comparaison l'ignorait).
 *
 * Rien de ces sommes ne permet de retrouver une valeur, et elles ne sortent
 * jamais au journal ni dans une réponse publique.
 */
const MASK = (1n << 64n) - 1n;

export function canonicalCell(value: unknown): string {
  if (value === null || value === undefined) return "∅";
  if (typeof value === "bigint") return `n:${value.toString()}`;
  if (typeof value === "number") return Number.isInteger(value) ? `n:${BigInt(value).toString()}` : `r:${value}`;
  if (typeof value === "boolean") return `n:${value ? 1 : 0}`;
  if (value instanceof Uint8Array) return `b:${Buffer.from(value).toString("hex")}`;
  return `s:${String(value)}`;
}

function hash64(text: string): bigint {
  return createHash("sha1").update(text).digest().readBigUInt64BE(0);
}

export interface TableChecksum {
  rows: number;
  /** Une somme par colonne, en hexadécimal (BigInt ne se sérialise pas en JSON). */
  columns: Record<string, string>;
}

/** Accumulateur d'une table : on lui donne des lignes, il rend la somme. */
export class ChecksumAccumulator {
  private rows = 0;
  private readonly sums: bigint[];

  constructor(private readonly columns: string[]) {
    this.sums = columns.map(() => 0n);
  }

  add(values: readonly unknown[]): void {
    this.rows++;
    for (let i = 0; i < this.columns.length; i++) {
      this.sums[i] = (this.sums[i] + hash64(canonicalCell(values[i]))) & MASK;
    }
  }

  result(): TableChecksum {
    return {
      rows: this.rows,
      columns: Object.fromEntries(this.columns.map((c, i) => [c, this.sums[i].toString(16)])),
    };
  }
}

/** Les colonnes qui diffèrent entre deux sommes d'une même table (noms seulement). */
export function checksumMismatch(expected: TableChecksum, actual: TableChecksum): string[] {
  const diff: string[] = [];
  if (expected.rows !== actual.rows) diff.push("(lignes)");
  for (const [column, sum] of Object.entries(expected.columns)) {
    if (actual.columns[column] !== sum) diff.push(column);
  }
  return diff;
}

/**
 * L'EMPREINTE d'une table de la source (§ 3.10) : nombre de lignes et une somme
 * de lignes entières, au moment de la copie. Relue plus tard sur la même source,
 * elle dit si quelqu'un y a écrit depuis (retour à l'image d'avant).
 */
export class RowFingerprint {
  private rows = 0;
  private sum = 0n;

  add(values: readonly unknown[]): void {
    this.rows++;
    this.sum = (this.sum + hash64(values.map(canonicalCell).join("\u001f"))) & MASK;
  }

  result(): { rows: number; sum: string } {
    return { rows: this.rows, sum: this.sum.toString(16) };
  }
}
