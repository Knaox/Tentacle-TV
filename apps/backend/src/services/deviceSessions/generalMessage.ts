import type { SessionServerMessage } from "./protocolMessages";

/**
 * Le titre que Jellyfin impose à un message envoyé SANS titre
 * (`SessionController`, 10.11 : un en-tête vide devient « Message from
 * Server »). Nos bandeaux disent déjà « Message de l'administrateur » : ce
 * titre anglais s'affichait en doublon, quelle que soit la langue — mesuré
 * depuis le gestionnaire des sessions, titre laissé vide.
 */
const JELLYFIN_DEFAULT_HEADER = "Message from Server";

/** `GeneralCommand` de Jellyfin → message du canal. */
export function generalMessage(name: string, args: Record<string, string>): SessionServerMessage {
  if (name === "DisplayMessage") {
    const timeout = Number(args.TimeoutMs);
    const header = (args.Header ?? "").trim();
    return {
      type: "session:message",
      header: header === JELLYFIN_DEFAULT_HEADER ? "" : header.slice(0, 200),
      text: (args.Text ?? "").slice(0, 2_000),
      ...(Number.isFinite(timeout) && timeout > 0 ? { timeoutMs: Math.min(timeout, 600_000) } : {}),
    };
  }
  return { type: "session:general", name, arguments: args };
}
