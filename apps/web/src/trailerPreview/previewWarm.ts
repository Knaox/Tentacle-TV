import { TRAILER_PREVIEW_WARM_MAX_SUBJECTS, trailerPreviewSubjectKey, type TrailerPreviewSubject } from "@tentacle-tv/shared";

/**
 * Les titres À L'ÉCRAN, pour la préparation de leur aperçu par le serveur
 * (`POST /api/trailers/preview/warm`, capacité `trailers.previewWarm`) : le
 * survol d'un titre préparé n'a plus rien à attendre — hors bibliothèque
 * compris, où tout se décidait au survol (2 à 4 s).
 *
 * Chaque carte qui a un aperçu inscrit son visuel (`trackPreviewWarm`, par
 * `useCardPreview`) : UN observateur de visibilité pour toute l'app, aucun
 * état React — une carte au repos ne porte toujours qu'une ancre. Quand la
 * page se pose (`settleMs` sans changement de visibilité), les titres visibles
 * partent par lots de 40, les derniers apparus d'abord. Un titre part deux
 * fois au plus en dix minutes — la seconde `followUpMs` plus tard, pour
 * recevoir ce que le serveur a préparé entre-temps —, et jamais s'il a déjà
 * son aperçu en cache. Rien ne part tant que la liaison racine n'a pas
 * branché l'envoi (`setPreviewWarmSender` : capacité du serveur, aperçus
 * permis sur cet appareil, page affichée).
 */

export interface PreviewWarmSender {
  /** Envoie les titres ; `true` : le serveur a répondu (sinon on attend `backoffMs` avant de recommencer). */
  send(subjects: TrailerPreviewSubject[]): Promise<boolean>;
  /** Le titre a-t-il déjà un aperçu en cache qui vaut encore ? Rien à demander pour lui. */
  isReady(subject: TrailerPreviewSubject): boolean;
}

export const PREVIEW_WARM_TIMING = {
  /** La page se pose : ce temps sans changement de visibilité, puis l'envoi. */
  settleMs: 450,
  /** Le second envoi d'un titre encore visible et pas prêt : ce que le serveur a préparé entre-temps revient. */
  followUpMs: 5_000,
  /** Deux envois par titre au plus dans cette fenêtre. */
  windowMs: 10 * 60_000,
  /** Un envoi refusé ou en panne : plus rien avant ce délai. */
  backoffMs: 10_000,
  /** La marge autour de l'écran : la carte qui va paraître au prochain cran de défilement. */
  rootMargin: "160px 0px",
} as const;

const T = PREVIEW_WARM_TIMING;

interface Sent {
  count: number;
  at: number;
}

const subjects = new Map<Element, TrailerPreviewSubject>();
/** Les visuels visibles, et depuis quand (les derniers apparus partent d'abord). */
const visibleSince = new Map<Element, number>();
const sent = new Map<string, Sent>();
let observer: IntersectionObserver | null = null;
let sender: PreviewWarmSender | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;
/** La page a bougé pendant un envoi : un nouveau regard dès qu'il a répondu. */
let changedWhileSending = false;
let pausedUntil = 0;

function schedule(delayMs: number): void {
  if (!sender) return;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => void flush(), Math.max(0, delayMs));
}

function onVisibility(entries: IntersectionObserverEntry[]): void {
  const now = Date.now();
  for (const entry of entries) {
    if (!subjects.has(entry.target)) continue;
    if (entry.isIntersecting) {
      if (!visibleSince.has(entry.target)) visibleSince.set(entry.target, now);
    } else {
      visibleSince.delete(entry.target);
    }
  }
  schedule(T.settleMs);
}

/** Quand ce titre peut repartir : maintenant, après le délai du second envoi, ou à la fin de la fenêtre. */
function eligibleAt(record: Sent | undefined, now: number): number {
  if (!record || now - record.at >= T.windowMs) return now;
  return record.count < 2 ? record.at + T.followUpMs : record.at + T.windowMs;
}

/** Les titres visibles à envoyer maintenant (40 au plus), et quand regarder de nouveau. */
function nextBatch(current: PreviewWarmSender, now: number): { batch: TrailerPreviewSubject[]; nextAt: number } {
  const batch: TrailerPreviewSubject[] = [];
  const seen = new Set<string>();
  let nextAt = Infinity;
  const latestFirst = [...visibleSince].sort((a, b) => b[1] - a[1]);
  for (const [element] of latestFirst) {
    const subject = subjects.get(element);
    if (!subject) continue;
    const key = trailerPreviewSubjectKey(subject);
    if (seen.has(key)) continue;
    seen.add(key);
    if (current.isReady(subject)) continue;
    const at = eligibleAt(sent.get(key), now);
    if (at > now) nextAt = Math.min(nextAt, at);
    else if (batch.length < TRAILER_PREVIEW_WARM_MAX_SUBJECTS) batch.push(subject);
    else nextAt = Math.min(nextAt, now + T.settleMs);
  }
  return { batch, nextAt };
}

async function flush(): Promise<void> {
  timer = null;
  const current = sender;
  if (!current) return;
  if (sending) {
    changedWhileSending = true;
    return;
  }
  const now = Date.now();
  if (now < pausedUntil) {
    schedule(pausedUntil - now);
    return;
  }
  const { batch, nextAt: later } = nextBatch(current, now);
  let nextAt = later;
  if (batch.length > 0) {
    for (const subject of batch) {
      const key = trailerPreviewSubjectKey(subject);
      const record = sent.get(key);
      sent.set(key, { count: !record || now - record.at >= T.windowMs ? 1 : record.count + 1, at: now });
    }
    sending = true;
    changedWhileSending = false;
    const answered = await current.send(batch).catch(() => false);
    sending = false;
    if (!answered) pausedUntil = Date.now() + T.backoffMs;
    nextAt = Math.min(nextAt, Date.now() + (changedWhileSending ? T.settleMs : T.followUpMs));
  }
  for (const [key, record] of sent) if (Date.now() - record.at >= T.windowMs) sent.delete(key);
  if (nextAt !== Infinity) schedule(Math.max(50, nextAt - Date.now()));
}

/**
 * Inscrit le visuel d'une carte et le titre de son aperçu ; rend la
 * désinscription. Sans `IntersectionObserver` (tests, très vieux moteur) :
 * rien.
 */
export function trackPreviewWarm(element: Element, subject: TrailerPreviewSubject): () => void {
  if (typeof IntersectionObserver === "undefined") return () => undefined;
  subjects.set(element, subject);
  observer ??= new IntersectionObserver(onVisibility, { rootMargin: T.rootMargin });
  observer.observe(element);
  return () => {
    subjects.delete(element);
    visibleSince.delete(element);
    observer?.unobserve(element);
  };
}

/**
 * Branche l'envoi (la liaison racine, quand la préparation est permise) :
 * les titres déjà visibles partent dès que la page se pose. Rend le
 * débranchement — plus rien ne part.
 */
export function setPreviewWarmSender(next: PreviewWarmSender): () => void {
  sender = next;
  schedule(T.settleMs);
  return () => {
    if (sender !== next) return;
    sender = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}

/** Pour les tests : tout oublier. */
export function resetPreviewWarm(): void {
  observer?.disconnect();
  observer = null;
  sender = null;
  if (timer !== null) clearTimeout(timer);
  timer = null;
  subjects.clear();
  visibleSince.clear();
  sent.clear();
  sending = false;
  changedWhileSending = false;
  pausedUntil = 0;
}
