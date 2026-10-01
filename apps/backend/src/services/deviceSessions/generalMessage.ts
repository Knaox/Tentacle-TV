import type { SessionServerMessage } from "./protocolMessages";

/** `GeneralCommand` de Jellyfin → message du canal. */
export function generalMessage(name: string, args: Record<string, string>): SessionServerMessage {
  if (name === "DisplayMessage") {
    const timeout = Number(args.TimeoutMs);
    return {
      type: "session:message",
      header: (args.Header ?? "").slice(0, 200),
      text: (args.Text ?? "").slice(0, 2_000),
      ...(Number.isFinite(timeout) && timeout > 0 ? { timeoutMs: Math.min(timeout, 600_000) } : {}),
    };
  }
  return { type: "session:general", name, arguments: args };
}
