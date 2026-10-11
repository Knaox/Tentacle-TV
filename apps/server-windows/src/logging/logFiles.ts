/**
 * Les journaux : sous Docker tout part sur stdout (`docker logs`) ; ici, rien
 * n'a de console. L'hôte écrit la sortie du serveur ET ses propres lignes dans
 * `logs\server-AAAA-MM-JJ.log` (date locale), un fichier par jour, sept jours
 * gardés. « Ouvrir le journal » ouvre celui du jour.
 */
import { appendFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export const KEEP_DAYS = 7;
const NAME = /^server-(\d{4})-(\d{2})-(\d{2})\.log$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function logFileName(date: Date): string {
  return `server-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.log`;
}

/** Les fichiers à supprimer : plus vieux que `keepDays` jours (aujourd'hui compris dans le compte). */
export function expiredLogs(names: readonly string[], today: Date, keepDays = KEEP_DAYS): string[] {
  const limit = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (keepDays - 1)).getTime();
  return names.filter((name) => {
    const match = NAME.exec(name);
    if (!match) return false;
    const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
    return day < limit;
  });
}

export class LogFiles {
  private currentDay = "";

  constructor(
    private readonly dir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Le fichier du jour (il peut ne pas exister encore). */
  currentFile(): string {
    return join(this.dir, logFileName(this.now()));
  }

  /** Une ligne de l'hôte, horodatée. */
  host(message: string): void {
    this.write(`${this.now().toISOString()} [hôte] ${message}\n`);
  }

  /** Un morceau de la sortie du serveur, tel quel (ses lignes sont déjà horodatées). */
  server(chunk: string): void {
    this.write(chunk.endsWith("\n") ? chunk : `${chunk}\n`);
  }

  private write(text: string): void {
    const file = this.currentFile();
    if (file !== this.currentDay) {
      this.currentDay = file;
      this.prune();
    }
    try {
      appendFileSync(file, text, "utf8");
    } catch {
      // Un journal qui ne s'écrit pas ne doit jamais arrêter l'hôte.
    }
  }

  private prune(): void {
    try {
      for (const name of expiredLogs(readdirSync(this.dir), this.now())) unlinkSync(join(this.dir, name));
    } catch {
      // Idem : le ménage est un confort.
    }
  }
}
