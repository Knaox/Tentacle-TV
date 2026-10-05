/**
 * Un lecteur qui passe par le VRAI code client — `tentacleSocket`,
 * `sessionChannel`, le magasin `jellyfinHealth` et la règle `outageView`
 * d'`api-client`, tels que les applications les embarquent (le WebSocket
 * global de Node tient lieu de celui du navigateur). Il prouve que la chaîne
 * entière, du backend à la règle du lecteur, tient — pas seulement le
 * protocole.
 */

import { acquireSocket, setWsBackendUrl } from "../../../../packages/api-client/src/socket/tentacleSocket";
import { configureSessionChannel } from "../../../../packages/api-client/src/socket/sessionChannel";
import { onJellyfinHealth, type JellyfinHealth } from "../../../../packages/api-client/src/socket/jellyfinHealth";
import { outageView, type OutageView } from "../../../../packages/api-client/src/playback/jellyfinOutage";

export interface ClientSample {
  at: number;
  health: JellyfinHealth;
  view: OutageView;
}

export class RealClient {
  readonly samples: ClientSample[] = [];
  private release: (() => void) | null = null;

  constructor(private readonly backendUrl: string, private readonly token: string) {}

  start(): void {
    setWsBackendUrl(this.backendUrl);
    configureSessionChannel({ deviceId: () => "banc-client-reel" });
    onJellyfinHealth((health) => {
      const at = Date.now();
      this.samples.push({ at, health, view: outageView(health, at) });
    });
    this.release = acquireSocket(this.token);
  }

  stop(): void {
    this.release?.();
  }

  /** Les phases vues par la règle du lecteur depuis `since`. */
  phases(since = 0): Array<{ at: number; phase: string; state: string; recoveries: number }> {
    return this.samples
      .filter((s) => s.at >= since)
      .map((s) => ({ at: s.at, phase: s.view.phase, state: s.health.state, recoveries: s.health.recoveries }));
  }
}
