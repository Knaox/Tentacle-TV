import { createHash } from "crypto";
import type { DeviceAuth } from "./deviceAuth";
import type { PlaybackReporter } from "./playbackReporter";
import type { PlaybackStateDto } from "./protocolMessages";

/** La clé d'un appareil du registre : son jeton Jellyfin et l'identité
 *  présentée pour lui (`registry.ts`). */
export function keyOf(auth: DeviceAuth): string {
  return createHash("sha256")
    .update(auth.token)
    .update("\u0000")
    .update(auth.identity?.deviceId ?? "")
    .digest("hex");
}

/** Le même titre, la même séance de lecture. */
export function samePlayback(reporter: PlaybackReporter, state: PlaybackStateDto): boolean {
  const current = reporter.current();
  return current !== null && current.itemId === state.itemId && (current.playSessionId ?? "") === (state.playSessionId ?? "");
}
