/* ------------------------------------------------------------------ */
/*  Les places d'extraction : peu à la fois, la lecture d'abord        */
/*                                                                     */
/*  Chaque extraction est un travail Python (ouvrier ou ligne de       */
/*  commande) : deux à la fois au plus sur tout le serveur — une fiche */
/*  ouverte en prépare une, un défilement rapide de fiches ne doit pas */
/*  lancer dix processus sur un petit serveur. Une LECTURE (une TV     */
/*  lance la bande-annonce, une fiche la prépare) passe toujours       */
/*  devant un APERÇU (le survol d'une carte) qui attend, et les        */
/*  aperçus n'occupent jamais toutes les places : un survol de rangée  */
/*  ne retarde pas la bande-annonce que quelqu'un vient de lancer.     */
/* ------------------------------------------------------------------ */

export type ExtractionPriority = "play" | "preview";

export interface ExtractionSlots {
  /** Lance `task` dès qu'une place le permet ; la place est rendue à sa fin, quelle qu'elle soit. */
  run<T>(priority: ExtractionPriority, task: () => Promise<T>): Promise<T>;
  /** L'occupation, pour les tests et le journal. */
  state(): { running: number; previews: number; waiting: Record<ExtractionPriority, number> };
}

const ORDER: readonly ExtractionPriority[] = ["play", "preview"];

export function createExtractionSlots(max: number, maxPreviews: number): ExtractionSlots {
  let running = 0;
  let previews = 0;
  const waiting: Record<ExtractionPriority, Array<() => void>> = { play: [], preview: [] };

  const fits = (priority: ExtractionPriority) => running < max && (priority === "play" || previews < maxPreviews);
  const take = (priority: ExtractionPriority) => {
    running++;
    if (priority === "preview") previews++;
  };
  const give = (priority: ExtractionPriority) => {
    running--;
    if (priority === "preview") previews--;
  };

  /**
   * Une place s'est libérée : les lectures qui attendent d'abord, puis un
   * aperçu s'il peut la prendre. La place est prise ICI, avant le réveil :
   * une demande arrivée entre-temps ne la vole pas.
   */
  function wake(): void {
    for (const priority of ORDER) {
      while (waiting[priority].length > 0 && fits(priority)) {
        take(priority);
        waiting[priority].shift()?.();
      }
    }
  }

  async function run<T>(priority: ExtractionPriority, task: () => Promise<T>): Promise<T> {
    const ahead = priority === "play" ? waiting.play.length : waiting.play.length + waiting.preview.length;
    if (ahead === 0 && fits(priority)) take(priority);
    else await new Promise<void>((go) => waiting[priority].push(go));
    try {
      return await task();
    } finally {
      give(priority);
      wake();
    }
  }

  return {
    run,
    state: () => ({ running, previews, waiting: { play: waiting.play.length, preview: waiting.preview.length } }),
  };
}
