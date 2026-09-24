/**
 * Le compte rendu du banc : chaque vérification est notée (réussie ou non,
 * avec ce qu'on a vu), rien ne s'arrête à la première erreur, le bilan dit
 * tout à la fin.
 */

export interface CheckResult {
  phase: string;
  name: string;
  ok: boolean;
  detail?: string;
}

export class Checks {
  readonly results: CheckResult[] = [];
  private phase = "";

  begin(phase: string): void {
    this.phase = phase;
    console.log(`\n━━ ${phase}`);
  }

  that(name: string, ok: boolean, detail?: unknown): void {
    const text = detail === undefined ? undefined : typeof detail === "string" ? detail : JSON.stringify(detail);
    this.results.push({ phase: this.phase, name, ok, detail: text });
    console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && text ? `\n      vu : ${text}` : ""}`);
  }

  /** Une étape qui doit aboutir (attente, appel) : son échec est noté, la suite continue. */
  async step(name: string, run: () => Promise<void>): Promise<boolean> {
    try {
      await run();
      return true;
    } catch (err) {
      this.that(name, false, err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  get failed(): CheckResult[] {
    return this.results.filter((r) => !r.ok);
  }

  summary(): string {
    const ok = this.results.length - this.failed.length;
    return `${ok}/${this.results.length} vérifications réussies`;
  }
}
