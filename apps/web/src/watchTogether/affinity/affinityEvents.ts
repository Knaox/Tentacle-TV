import type { WtAffinityMessage } from "@tentacle-tv/shared";
import { closeRoomModal } from "../roomModalStore";
import {
  applyAffinityPush, armLaunchFollow, closeAffinity, getAffinitySnapshot, openAffinity, showAffinityNotice,
  showAffinityView,
} from "./affinityStore";
import { KIND_LABEL_KEY } from "./affinityText";

/**
 * Affinité — ce qu'un message `wt:affinity` change à l'écran, hors React (le
 * même motif que `wtEvents.ts`) : l'état est appliqué, puis les effets. La
 * séance est un mode PARTAGÉ :
 *
 * - lancée, reprise ou passée à un autre type par un autre : elle s'ouvre
 *   chez moi, sur la pile, et le dit — sauf devant un film : un toast, puis
 *   la pilule quand je reviens ;
 * - un match s'affiche chez tous les participants (il se lit dans l'état) ;
 *   qui ne swipe pas l'apprend par un toast ;
 * - écarté par un autre (« Continuer à swiper ») ou défait par un dédit : la
 *   pile reprend, et on dit pourquoi ;
 * - refermée — l'autre l'a quittée, un match est parti en lecture, la salle
 *   est passée sous deux membres : la modale se ferme chez tous, avec la
 *   raison ; un lancement m'emmène si je swipais (fenêtre de suivi).
 *
 * Modale ouverte, un fait se dit DANS la modale (`notice`) ; fermée, par un toast.
 */

export interface AffinityEventContext {
  selfId: string;
  /** Le nom d'un membre de la salle. */
  nameOf: (userId: string | null) => string;
  toast: (type: "success" | "error" | "info", message: string) => void;
  /** t de l'espace « watchTogether ». */
  t: (key: string, options?: Record<string, unknown>) => string;
  /** Sur une page de lecture. */
  isWatching: () => boolean;
}

export function handleAffinityMessage(msg: WtAffinityMessage, ctx: AffinityEventContext): void {
  const before = getAffinitySnapshot();
  if (!applyAffinityPush(msg.state)) return;
  const { state, cause, match } = msg;
  const fromOther = msg.originUserId !== null && msg.originUserId !== ctx.selfId;
  const name = ctx.nameOf(msg.originUserId);
  const wasOpen = before.modal.open;

  // Refermée : la modale se ferme chez tous, lanceur compris.
  if (!state) {
    closeAffinity();
    if (cause === "launch" && fromOther && match) {
      if (wasOpen) armLaunchFollow();
      ctx.toast("info", ctx.t("affinityLaunchedBy", { name, title: match.title }));
    } else if (cause === "quit" && fromOther && before.state) {
      ctx.toast("info", ctx.t("affinityQuitBy", { name }));
    } else if (cause === "end" && before.state) {
      ctx.toast("info", ctx.t("affinityEnded"));
    }
    return;
  }

  switch (cause) {
    case "start":
    case "switch": {
      if (!fromOther) return;
      const kind = ctx.t(KIND_LABEL_KEY[state.kind]);
      const text = ctx.t(cause === "switch" ? "affinitySwitchedBy" : "affinityStartedBy", { name, kind });
      if (ctx.isWatching()) {
        ctx.toast("info", text);
        return;
      }
      // Lancée chez l'un, ouverte chez tous : sur la pile, par-dessus la salle.
      closeRoomModal();
      if (wasOpen) showAffinityView("deck");
      else openAffinity("deck");
      showAffinityNotice(msg.originUserId, text);
      return;
    }
    case "quit":
      // À trois ou plus, les autres swipent encore.
      if (fromOther && wasOpen) showAffinityNotice(msg.originUserId, ctx.t("affinityQuitBy", { name }));
      announceToOutsiders(msg, ctx);
      return;
    case "match":
      announceToOutsiders(msg, ctx);
      return;
    case "dismiss":
      if (fromOther && wasOpen && match) {
        showAffinityNotice(msg.originUserId, ctx.t("affinityDismissedBy", { name, title: match.title }));
      }
      return;
    case "unmatch":
      if (wasOpen && match) showAffinityNotice(msg.originUserId, ctx.t("affinityUnmatched", { title: match.title }));
      return;
    default:
      return;
  }
}

/** Un match chez qui ne swipe pas : un toast — les participants l'ont à l'écran. */
function announceToOutsiders(msg: WtAffinityMessage, ctx: AffinityEventContext): void {
  const keys = msg.matchKeys ?? [];
  const { state } = msg;
  if (!state || keys.length === 0 || state.participants.some((p) => p.userId === ctx.selfId)) return;
  const title = state.proposals.find((m) => m.key === keys[0])?.title;
  if (title) ctx.toast("success", `${ctx.t("affinityMatchTitle")} ${title}`);
}

/**
 * Après une relecture de l'état (montage, reconnexion, séance périmée) :
 * participant d'une séance ouverte — la page a été rechargée —, elle se
 * rouvre chez moi ; ma pile ouverte sur une séance qui n'existe plus — une
 * fermeture manquée pendant une coupure —, elle se ferme, et le dit.
 */
export function reconcileAffinity(ctx: AffinityEventContext): void {
  const { state, modal } = getAffinitySnapshot();
  if (!state) {
    if (modal.open && modal.view === "deck") {
      closeAffinity();
      ctx.toast("info", ctx.t("affinityClosed"));
    }
    return;
  }
  if (modal.open || ctx.isWatching()) return;
  if (state.participants.some((p) => p.userId === ctx.selfId)) openAffinity("deck");
}
