import type { WtAffinityMessage } from "@tentacle-tv/shared";
import {
  applyAffinityPush, armLaunchFollow, closeAffinity, getAffinitySnapshot, leaveAffinityMatch, openAffinity,
  showAffinityMatch, showAffinityView,
} from "./affinityStore";
import { KIND_LABEL_KEY } from "./affinityText";

/**
 * Affinité — ce qu'un message `wt:affinity` change à l'écran, hors React (le
 * même motif que `wtEvents.ts`) : l'état est appliqué, puis les effets.
 *
 * - un match s'annonce à TOUTE la salle, participants ou non — sauf à qui
 *   regarde un film : un toast lui suffit, rien ne recouvre son lecteur ;
 * - plusieurs matchs d'un coup (le seul qui manquait est parti) : la liste ;
 * - un match lancé par un autre : qui swipait le suivra (fenêtre de suivi) ;
 * - le type changé ou la séance lancée par un autre pendant qu'on choisissait :
 *   on rejoint la pile ;
 * - la séance arrêtée (moins de deux membres) : la modale se ferme.
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
  const { state, cause } = msg;
  const { modal } = getAffinitySnapshot();
  const fromOther = msg.originUserId !== null && msg.originUserId !== ctx.selfId;
  const kind = state ? ctx.t(KIND_LABEL_KEY[state.kind]) : "";
  const name = ctx.nameOf(msg.originUserId);

  switch (cause) {
    case "start":
    case "switch":
      if (!fromOther) return;
      if (cause === "switch" || modal.open) {
        ctx.toast("info", ctx.t(cause === "switch" ? "affinitySwitchedBy" : "affinityStartedBy", { name, kind }));
      }
      // Je choisissais un type moi aussi : la pile de l'autre est là.
      if (modal.open && modal.view === "kinds") showAffinityView("deck");
      return;
    case "match": {
      const keys = msg.matchKeys ?? [];
      if (keys.length === 0 || !state) return;
      if (ctx.isWatching()) {
        const title = state.matches.find((m) => m.key === keys[0])?.title ?? "";
        ctx.toast("success", `${ctx.t("affinityMatchTitle")} ${title}`);
        return;
      }
      if (keys.length === 1) showAffinityMatch(keys[0]);
      else if (modal.open) showAffinityView("matches");
      else openAffinity("matches");
      return;
    }
    case "unmatch": {
      // Le match affiché vient de tomber (un dédit) : on le dit, on revient.
      if (modal.open && modal.view === "match" && modal.matchKey && !state?.matches.some((m) => m.key === modal.matchKey)) {
        const title = before.state?.matches.find((m) => m.key === modal.matchKey)?.title ?? "";
        ctx.toast("info", ctx.t("affinityUnmatched", { title }));
        leaveAffinityMatch();
      }
      return;
    }
    case "launch": {
      const launch = state?.launch;
      if (!fromOther || !launch) return;
      const title = state.matches.find((m) => m.key === launch.key)?.title ?? "";
      ctx.toast("info", ctx.t("affinityLaunchedBy", { name, title }));
      if (modal.open) {
        armLaunchFollow();
        closeAffinity();
      }
      return;
    }
    case "end":
      if (before.state) ctx.toast("info", ctx.t("affinityEnded"));
      closeAffinity();
      return;
    default:
      return;
  }
}
