import { getPrisma } from "./db";
import { submitRequest, getRequestStatus, mapSeerrStatus, fetchAllSeerrRequests, fetchMediaDetail } from "./overseerr";

const POLL_INTERVAL = 60_000; // 60 seconds
const MAX_RETRIES = 3;
const SUBMIT_DELAY = 15_000; // 15s between Seerr API calls
const SYNC_INTERVAL = 5; // full Seerr sync every N cycles

const STATUS_LABEL: Record<string, string> = {
  submitted: "Soumise",
  approved: "Approuvée",
  available: "Disponible",
  failed: "Échouée",
  declined: "Refusée",
};

let timer: ReturnType<typeof setInterval> | null = null;
let processing = false;
let cycleCount = SYNC_INTERVAL; // sync on first run

/**
 * Process the next pending request in FIFO order.
 */
async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    const prisma = getPrisma();
    // 1. Submit pending requests to Seerr
    const pending: any = await prisma.mediaRequest.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
    });

    if (pending) {
      try {
        const result: any = await submitRequest(
          pending.mediaType as "movie" | "tv",
          pending.tmdbId
        );

        await prisma.mediaRequest.update({
          where: { id: pending.id },
          data: {
            status: "submitted",
            seerrRequestId: result.id,
            seerrMediaId: result.mediaId,
            lastError: null,
          },
        });

        await prisma.notification.create({
          data: {
            jellyfinUserId: pending.jellyfinUserId,
            type: "request_status",
            title: "Demande : Soumise",
            body: `Votre demande « ${pending.title} » a été soumise avec succès.`,
            refId: pending.id,
          },
        }).catch(() => {});

        // Delay before next API call
        await sleep(SUBMIT_DELAY);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const newRetry = pending.retryCount + 1;

        await prisma.mediaRequest.update({
          where: { id: pending.id },
          data: {
            retryCount: newRetry,
            lastError: msg,
            status: newRetry >= MAX_RETRIES ? "failed" : "pending",
          },
        });
      }
    }

    // 2. Sync submitted requests with Seerr status
    const submitted: any[] = await prisma.mediaRequest.findMany({
      where: { status: { in: ["submitted", "approved"] } },
      orderBy: { updatedAt: "asc" },
      take: 5,
    });

    for (const req of submitted) {
      if (!req.seerrRequestId) continue;

      try {
        const status: any = await getRequestStatus(req.seerrRequestId);
        if (!status) continue;

        const newStatus = mapSeerrStatus(status.status, status.mediaStatus);

        if (newStatus !== req.status) {
          await prisma.mediaRequest.update({
            where: { id: req.id },
            data: { status: newStatus },
          });

          const label = STATUS_LABEL[newStatus] ?? newStatus;
          await prisma.notification.create({
            data: {
              jellyfinUserId: req.jellyfinUserId,
              type: "request_status",
              title: `Demande : ${label}`,
              body: `Votre demande « ${req.title} » est maintenant ${label.toLowerCase()}.`,
              refId: req.id,
            },
          }).catch(() => {});
        }
      } catch {
        // Silently continue — will retry next cycle
      }
    }
    // 3. Sync Seerr requests into local DB (every SYNC_INTERVAL cycles)
    cycleCount++;
    if (cycleCount >= SYNC_INTERVAL) {
      cycleCount = 0;
      await syncSeerrRequests();
    }
  } catch (err) {
    console.error("[RequestWorker] Error:", err);
  } finally {
    processing = false;
  }
}

/**
 * Import Seerr requests that don't exist in our DB yet, and update status of existing ones.
 */
async function syncSeerrRequests(): Promise<void> {
  try {
    const prisma = getPrisma();
    const seerrData: any = await fetchAllSeerrRequests(100, 0);

    const existing: any[] = await prisma.mediaRequest.findMany({
      where: { seerrRequestId: { not: null } },
      select: { seerrRequestId: true, status: true, id: true },
    });
    
    const existingMap = new Map(existing.map((r: any) => [r.seerrRequestId!, { id: r.id, status: r.status }]));

    for (const req of (seerrData.results as any[])) {
      const newStatus = mapSeerrStatus(req.status, req.media?.status ?? 0);
      const found = existingMap.get(req.id);

      if (found) {
        if (found.status !== newStatus) {
          await prisma.mediaRequest.update({
            where: { id: found.id },
            data: { status: newStatus },
          });
        }
        continue;
      }

      let title = `#${req.media.tmdbId}`;
      let posterPath: string | null = null;
      try {
        const detail: any = await fetchMediaDetail(req.media.mediaType, req.media.tmdbId);
        title = detail.title;
        posterPath = detail.posterPath;
      } catch { /* use fallback title */ }

      const username = req.requestedBy?.displayName || req.requestedBy?.username || "Inconnu";
      const jellyfinUserId = req.requestedBy?.jellyfinUserId || "seerr-import";

      await prisma.mediaRequest.create({
        data: {
          jellyfinUserId,
          username,
          mediaType: req.media.mediaType === "movie" ? "movie" : "tv",
          tmdbId: req.media.tmdbId,
          title,
          posterPath,
          status: newStatus,
          seerrRequestId: req.id,
          createdAt: new Date(req.createdAt),
        },
      }).catch(() => {
        // Duplicate or constraint error — skip silently
      });
    }

    console.debug("[RequestWorker] Seerr sync complete:", seerrData.results?.length || 0, "requests checked");
  } catch (err) {
    console.error("[RequestWorker] Seerr sync error:", err instanceof Error ? err.message : err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function startRequestWorker(): void {
  if (timer) return;
  console.log("[RequestWorker] Started (interval: 60s)");
  timer = setInterval(processQueue, POLL_INTERVAL);
  processQueue();
}

export function stopRequestWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[RequestWorker] Stopped");
  }
}