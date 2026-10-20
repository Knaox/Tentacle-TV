import {
  decideNotificationTap,
  resolveNotificationDestination,
  type LibraryTitleLookup,
  type NotifPluginMeta,
} from "@tentacle-tv/api-client";
import { parseNotificationTarget } from "@tentacle-tv/shared";

/**
 * Ouvrir une notification, d'où qu'elle vienne : le centre (la cloche) ou une
 * push (premier plan, arrière-plan, démarrage à froid). UNE seule suite de
 * gestes, celle de la règle partagée (`decideNotificationTap`) ; les ports
 * sont les gestes propres à l'app (naviguer, ouvrir l'affiche…), injectés —
 * ce module n'importe ni React Native ni expo-router, il se teste seul.
 */

export type NotificationOrigin = "center" | "push";

export interface NotificationOpenPorts {
  /** Aller à une route (onglet rejoint sans empiler, fiche empilée). */
  goTo: (route: string) => void;
  /**
   * Les notifications locales du hors ligne : le titre prêt quand le lot n'en
   * comptait qu'un (`itemId`), sinon l'écran « Sur cet appareil ».
   */
  openOnDevice: (itemId: string | null) => void;
  /** L'affiche d'une invitation de la Famille, relue au serveur par sa session. */
  openFamilyPoster: (invitationId: string) => void;
  /** Les métadonnées des extensions actives ; un échec ou un délai vaut « aucune ». */
  loadPlugins: () => Promise<NotifPluginMeta[]>;
  lookupTitle: LibraryTitleLookup;
}

/** Ce qu'une notification apporte : une ligne du centre, ou les données d'une push (lues, jamais crues). */
export interface OpenableNotification {
  type?: string;
  refId?: string | null;
  target?: unknown;
  /** « Prêt à regarder hors ligne » d'un seul titre : lequel (notification locale, lue, jamais crue). */
  itemId?: unknown;
}

/** La fiche locale d'un titre gardé hors ligne. */
export function onDeviceItemRoute(itemId: string): string {
  return `/on-device/item/${encodeURIComponent(itemId)}`;
}

/** Une push sans destination ouvre l'accueil : l'app vient de s'ouvrir, il faut bien un écran. */
export const PUSH_FALLBACK_ROUTE = "/(tabs)";

/**
 * Rend la route suivie (ou null : rien à ouvrir). Depuis le centre, une
 * notification sans destination ne fait rien de plus que se marquer lue
 * (comme sur le bureau, où elle n'a pas de chevron) ; depuis une push, elle
 * ouvre l'accueil.
 */
export async function openNotification(
  input: OpenableNotification,
  origin: NotificationOrigin,
  ports: NotificationOpenPorts,
): Promise<string | null> {
  const n = { type: input.type ?? "", refId: input.refId ?? null, target: parseNotificationTarget(input.target ?? null) };
  const action = decideNotificationTap(n);
  if (action.kind === "onDevice") {
    const itemId = n.type === "offline_ready" && typeof input.itemId === "string" && input.itemId !== "" ? input.itemId : null;
    ports.openOnDevice(itemId);
    return itemId === null ? "/on-device" : onDeviceItemRoute(itemId);
  }
  if (action.kind === "familyPoster") {
    ports.openFamilyPoster(action.invitationId);
    return null;
  }
  const plugins = action.needsPlugins ? await ports.loadPlugins().catch(() => []) : [];
  const route = await resolveNotificationDestination(n, "mobile", plugins, ports.lookupTitle);
  const next = route ?? (origin === "push" ? PUSH_FALLBACK_ROUTE : null);
  if (next) ports.goTo(next);
  return next;
}
