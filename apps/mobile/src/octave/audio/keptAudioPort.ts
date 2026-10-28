/**
 * Octave (mobile) — le PORT de la copie gardée hors ligne pour le moteur audio. Le moteur ne désigne jamais un
 * chemin de lui-même : la source porte `kept` (« ce titre, pour ce compte », `bridgeSource`), et l'axe du hors
 * ligne (`m5`) branche ici la fonction qui rend le fichier local de CETTE copie — ou `null` (copie absente :
 * le flux du serveur, `url`, reste le repli). Une source qui porte déjà `kept.localUri` (résolue en amont) est
 * lue telle quelle.
 *
 *   const off = setOctaveKeptFileResolver(({ userId, trackKey }) => keptFileUri(userId, trackKey));
 */

export interface KeptFileRequest {
  userId: string;
  /** La clé sous laquelle la copie est gardée. */
  trackKey: string;
}

/** Rend une adresse `file://…` lisible par le moteur, ou `null`. */
export type KeptFileResolver = (request: KeptFileRequest) => string | null | Promise<string | null>;

let resolver: KeptFileResolver | null = null;

export function setOctaveKeptFileResolver(next: KeptFileResolver): () => void {
  resolver = next;
  return () => {
    if (resolver === next) resolver = null;
  };
}

interface KeptField {
  userId?: unknown;
  trackKey?: unknown;
  localUri?: unknown;
}

/** Le fichier local d'une source du pont (`AudioBridgeSource`), ou `null`. Ne lève jamais. */
export async function keptFileFor(source: { kept?: unknown }): Promise<string | null> {
  const kept = source.kept as KeptField | undefined;
  if (!kept || typeof kept !== "object") return null;
  if (typeof kept.localUri === "string" && kept.localUri !== "") return kept.localUri;
  if (resolver === null || typeof kept.userId !== "string" || typeof kept.trackKey !== "string") return null;
  try {
    const uri = await resolver({ userId: kept.userId, trackKey: kept.trackKey });
    return typeof uri === "string" && uri !== "" ? uri : null;
  } catch {
    return null;
  }
}
