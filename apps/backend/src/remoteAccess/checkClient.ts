import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { isIP } from "net";
import { z } from "zod";
import { CHECK_PATH, CHECK_PROTOCOL_VERSION, type CheckRequest, type CheckResponse } from "./checkProtocol";

/**
 * L'appel au service de test, dans UNE famille d'adresses (IPv4, puis IPv6) :
 * la famille est forcée à la résolution du nom du service, si bien que le
 * service voit l'adresse publique de cette famille — c'est elle qu'il teste.
 *
 * Un serveur sans IPv6 vers Internet (le cas courant dans Docker) ne peut
 * pas joindre le service en IPv6 : « non testable », pas « fermé ».
 */
export type CheckCall =
  | { kind: "ok"; response: CheckResponse }
  | { kind: "family_unavailable" }
  | { kind: "unavailable" }
  | { kind: "rate_limited" }
  | { kind: "rejected" };

const verdict = z.enum([
  "open", "redirect", "wrong_service", "http_error", "timeout", "refused", "unreachable",
  "tls_self_signed", "tls_expired", "tls_name_mismatch", "tls_untrusted", "tls_error", "dns_mismatch", "dns_error",
]);

const responseSchema = z
  .object({
    protocol: z.literal(CHECK_PROTOCOL_VERSION),
    sourceIp: z.string().max(64).refine((value) => isIP(value) !== 0),
    family: z.union([z.literal(4), z.literal(6)]),
    results: z
      .array(
        z.object({
          verdict,
          httpStatus: z.number().int().min(100).max(599).nullable(),
          certificateExpires: z.string().max(40).nullable(),
        }),
      )
      .max(8),
  })
  .strict();

/** Erreurs de connexion qui disent « cette famille n'existe pas ici » (pas de route, pas d'adresse). */
const FAMILY_ERRORS = new Set(["ENETUNREACH", "EHOSTUNREACH", "EADDRNOTAVAIL", "EAFNOSUPPORT", "ENOTFOUND", "EAI_ADDRFAMILY", "EAI_NONAME", "EAI_NODATA"]);

export function isFamilyError(code: string | undefined): boolean {
  return code !== undefined && FAMILY_ERRORS.has(code);
}

/** Le verdict d'un test prend au plus le temps de ses cibles (5 s chacune), plus la marge. */
const CALL_TIMEOUT_MS = 30_000;
const MAX_BODY = 16 * 1024;

export function callCheckService(serviceUrl: string, body: CheckRequest, family: 4 | 6): Promise<CheckCall> {
  let url: URL;
  try {
    url = new URL(CHECK_PATH, serviceUrl);
  } catch {
    return Promise.resolve({ kind: "unavailable" });
  }
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;
  const payload = JSON.stringify(body);

  return new Promise<CheckCall>((resolve) => {
    const req = send(
      url,
      {
        method: "POST",
        family,
        timeout: CALL_TIMEOUT_MS,
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload), "user-agent": "Tentacle-Server" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BODY) req.destroy();
          else chunks.push(chunk);
        });
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          if (status === 429) return resolve({ kind: "rate_limited" });
          if (status === 400 || status === 409) return resolve({ kind: "rejected" });
          if (status !== 200) return resolve({ kind: "unavailable" });
          try {
            const parsed = responseSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            resolve(parsed.success && parsed.data.results.length === body.targets.length ? { kind: "ok", response: parsed.data } : { kind: "unavailable" });
          } catch {
            resolve({ kind: "unavailable" });
          }
        });
        res.on("error", () => resolve({ kind: "unavailable" }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (err: NodeJS.ErrnoException) => {
      resolve(family === 6 && isFamilyError(err.code) ? { kind: "family_unavailable" } : { kind: "unavailable" });
    });
    req.end(payload);
  });
}
