// Client backend → relay Cloudflare pour le code de jumelage de provisionnement.
// Le backend « grave » dans le relay une entrée pré-confirmée et persistante
// (permanent:true, TTL = jusqu'à la date d'expiration) que la TV résout en
// tapant le code. Authentifié par un secret partagé (RELAY_ADMIN_SECRET) connu
// du backend ET du worker relay.

const RELAY_URL = (process.env.PAIRING_RELAY_URL || "https://pair.tentacletv.app").replace(/\/$/, "");

function relaySecret(): string {
  const secret = process.env.RELAY_ADMIN_SECRET;
  if (!secret) {
    throw new Error("RELAY_ADMIN_SECRET n'est pas configuré sur le serveur");
  }
  return secret;
}

export interface ProvisionSeedPayload {
  code: string;
  serverUrl: string;
  token: string;
  user: { id: string; name: string };
  /** Durée de vie de l'entrée relay en secondes (= jusqu'à la date d'expiration). */
  expiresInSec: number;
}

/** Crée/écrase l'entrée de provisionnement dans le relay (pré-confirmée). */
export async function seedProvisioningCode(payload: ProvisionSeedPayload): Promise<void> {
  const res = await fetch(`${RELAY_URL}/provision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Relay-Admin-Secret": relaySecret(),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(`Relay a refusé le provisionnement: ${msg}`);
  }
}

/** Supprime l'entrée de provisionnement du relay (désactivation / régénération). */
export async function deleteProvisioningCode(code: string): Promise<void> {
  try {
    await fetch(`${RELAY_URL}/provision/${encodeURIComponent(code)}`, {
      method: "DELETE",
      headers: { "X-Relay-Admin-Secret": relaySecret() },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Non bloquant : l'entrée KV expire d'elle-même (TTL) si la suppression échoue.
  }
}
