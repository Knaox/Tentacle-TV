import type { SourceRow } from "../legacySource/mariadbReader";
import { ChecksumAccumulator, RowFingerprint, type TableChecksum } from "../verify/checksums";

/**
 * Ce que chaque table laisse derrière sa copie : la somme ATTENDUE de ce qui a
 * été écrit (comparée ensuite à ce que SQLite rend) et l'EMPREINTE de la source
 * (§ 3.10 — sauf pour un cache : une divergence de cache ne déclenche rien).
 */
export interface TableObservers {
  raw: (row: SourceRow) => void;
  written: (values: unknown[]) => void;
}

export class CopyObservations {
  private readonly expected = new Map<string, ChecksumAccumulator>();
  private readonly fingerprints = new Map<string, RowFingerprint>();

  constructor(private readonly cacheTables: ReadonlySet<string>) {}

  for(table: string, columns: string[]): TableObservers {
    const sum = new ChecksumAccumulator(columns);
    this.expected.set(table, sum);
    const fingerprint = this.cacheTables.has(table) ? null : new RowFingerprint();
    if (fingerprint) this.fingerprints.set(table, fingerprint);
    return {
      raw: (row) => fingerprint?.add(row),
      written: (values) => sum.add(values),
    };
  }

  expectedSums(): Record<string, TableChecksum> {
    return Object.fromEntries([...this.expected].map(([t, acc]) => [t, acc.result()]));
  }

  sourceFingerprint(): Record<string, { rows: number; sum: string }> {
    return Object.fromEntries([...this.fingerprints].map(([t, fp]) => [t, fp.result()]));
  }
}
