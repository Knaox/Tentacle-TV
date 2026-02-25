import { getSeerrUrl, getSeerrApiKey } from "./configStore";

function getHeaders(): Record<string, string> {
  return { "X-Api-Key": getSeerrApiKey() || "", "Content-Type": "application/json" };
}
function getBaseUrl(): string {
  return (getSeerrUrl() || "").replace(/\/$/, "");
}

export interface SeerrRequestResult {
  id: number;
  mediaId: number;
  status: number; // 1=pending, 2=approved, 3=declined, 4=available
}

export interface SeerrMediaStatus {
  id: number;
  status: number;
  status4k: number;
}

/**
 * Submit a media request to Overseerr/Seerr.
 */
export async function submitRequest(
  mediaType: "movie" | "tv",
  tmdbId: number
): Promise<SeerrRequestResult> {
  const res = await fetch(`${getBaseUrl()}/api/v1/request`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ mediaType, mediaId: tmdbId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Request service error (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Check the media status in Overseerr/Seerr.
 */
export async function getMediaStatus(
  mediaType: "movie" | "tv",
  tmdbId: number
): Promise<SeerrMediaStatus | null> {
  const endpoint = mediaType === "movie" ? "movie" : "tv";
  const res = await fetch(`${getBaseUrl()}/api/v1/${endpoint}/${tmdbId}`, { headers });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Media status check failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    status: data.mediaInfo?.status ?? 0,
    status4k: data.mediaInfo?.status4k ?? 0,
  };
}

/**
 * Get a specific request + media status from Overseerr/Seerr.
 */
export async function getRequestStatus(requestId: number): Promise<{ status: number; mediaStatus: number } | null> {
  const res = await fetch(`${getBaseUrl()}/api/v1/request/${requestId}`, { headers });

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const data = await res.json();
  return { status: data.status, mediaStatus: data.media?.status ?? 0 };
}

/**
 * Map Seerr request status code to our internal status string.
 * Request: 1=PENDING, 2=APPROVED, 3=DECLINED
 * Media:   1=UNKNOWN, 2=PENDING, 3=PROCESSING, 4=PARTIAL, 5=AVAILABLE
 */
export function mapSeerrStatus(requestStatus: number, mediaStatus = 0): string {
  if (mediaStatus >= 5) return "available";
  switch (requestStatus) {
    case 1: return "submitted";
    case 2: return "approved";
    case 3: return "declined";
    default: return "submitted";
  }
}
