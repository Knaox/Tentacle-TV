import { PrismaClient } from "@prisma/client";
import { submitRequest, getRequestStatus, mapSeerrStatus } from "./overseerr";

const prisma = new PrismaClient();
const POLL_INTERVAL = 60_000; // 60 seconds
const MAX_RETRIES = 3;
const SUBMIT_DELAY = 15_000; // 15s between Seerr API calls

let timer: ReturnType<typeof setInterval> | null = null;
let processing = false;

/**
 * Process the next pending request in FIFO order.
 */
async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    // 1. Submit pending requests to Seerr
    const pending = await prisma.mediaRequest.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
    });

    if (pending) {
      try {
        const result = await submitRequest(
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
    const submitted = await prisma.mediaRequest.findMany({
      where: { status: { in: ["submitted", "approved"] } },
      orderBy: { updatedAt: "asc" },
      take: 5,
    });

    for (const req of submitted) {
      if (!req.seerrRequestId) continue;

      try {
        const status = await getRequestStatus(req.seerrRequestId);
        if (!status) continue;

        // Use both request + media status for accurate mapping
        const newStatus = mapSeerrStatus(status.status, status.mediaStatus);

        if (newStatus !== req.status) {
          await prisma.mediaRequest.update({
            where: { id: req.id },
            data: { status: newStatus },
          });
        }
      } catch {
        // Silently continue — will retry next cycle
      }
    }
  } catch (err) {
    console.error("[RequestWorker] Error:", err);
  } finally {
    processing = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Start the background request worker.
 */
export function startRequestWorker(): void {
  if (timer) return;
  console.log("[RequestWorker] Started (interval: 60s)");
  timer = setInterval(processQueue, POLL_INTERVAL);
  // Run immediately on start
  processQueue();
}

/**
 * Stop the background request worker.
 */
export function stopRequestWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[RequestWorker] Stopped");
  }
}
