import { randomBytes } from "crypto";
import type { DeclaredPlaybackDto } from "./protocolMessages";
import type { ChannelConnection } from "./registryTypes";

/**
 * Les écoutes que les lecteurs DÉCLARENT eux-mêmes (`playback:declare`,
 * capacité `sessions.musicControl`) : la musique d'Octave. Une par connexion
 * `/api/ws` — la dernière déclarée fait foi, `null` l'efface, la connexion
 * fermée aussi.
 *
 * L'identifiant (`ext-…`) reste le même d'un titre à l'autre : c'est par lui
 * que le tableau de bord commande une lecture d'EXTENSION, que Jellyfin ne
 * connaît pas. Aléatoire, il ne dit rien de la connexion.
 */

export interface DeclaredEntry {
  id: string;
  state: DeclaredPlaybackDto;
  /** Quand (horloge du serveur) la position déclarée était vraie. */
  at: number;
}

/** Le préfixe d'une session de tableau de bord qui n'existe pas chez Jellyfin. */
export const DECLARED_SESSION_PREFIX = "ext-";

export class DeclaredPlaybacks {
  private readonly byConnection = new Map<ChannelConnection, DeclaredEntry>();

  declare(conn: ChannelConnection, state: DeclaredPlaybackDto | null, now = Date.now()): void {
    if (state === null) {
      this.byConnection.delete(conn);
      return;
    }
    const id = this.byConnection.get(conn)?.id ?? `${DECLARED_SESSION_PREFIX}${randomBytes(12).toString("hex")}`;
    this.byConnection.set(conn, { id, state, at: now });
  }

  forget(conn: ChannelConnection): void {
    this.byConnection.delete(conn);
  }

  of(conn: ChannelConnection): DeclaredEntry | null {
    return this.byConnection.get(conn) ?? null;
  }

  /** La connexion qui porte cette lecture déclarée, ou `null`. */
  connectionOf(id: string): ChannelConnection | null {
    for (const [conn, entry] of this.byConnection) if (entry.id === id) return conn;
    return null;
  }

  entries(): Array<[ChannelConnection, DeclaredEntry]> {
    return [...this.byConnection];
  }
}
