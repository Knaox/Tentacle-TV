import type { TFunction } from "i18next";
import type { FamilyOverviewDto, FamilyProfileColor } from "@tentacle-tv/shared";
import type { ManageRowModel } from "@tentacle-tv/tv-core";
import type { InviteCandidateView, ManageViewModel } from "../../redesign/screens/profiles/ManageProfilesView";
import { refusalOfError } from "../../auth/profileOpening";
import type { manageListModel } from "./manageModel";
import { guestPinPad, manageSheetView } from "./manageSheetModel";
import { pinMessageOf, refusalMessage } from "./profilesModel";
import type { ManageActions } from "./useManageActions";
import type { ManageSheet } from "./useManageSheet";
import type { useManageUnlock } from "./useManageUnlock";

/** Ce que la vue de « Gérer les profils » reçoit, selon l'ouverture, la lecture de la famille et la page. */
export function buildManageModel(input: {
  unlock: ReturnType<typeof useManageUnlock>;
  overview: { data?: FamilyOverviewDto | null; error: unknown; isLoading?: boolean };
  list: ReturnType<typeof manageListModel> | null;
  actions: ManageActions;
  /** La fiche ouverte (sa ligne) et ses gestes. */
  sheetRow: ManageRowModel | null;
  sheet: ManageSheet;
  serverUrl: string | null;
  owner: { userId: string; name: string; color: FamilyProfileColor };
  candidates: InviteCandidateView[] | null;
  more: boolean;
  language: string;
  t: TFunction;
}): ManageViewModel {
  const { unlock, overview, list, actions, owner, t } = input;
  if (unlock.phase === "needsPin") return { kind: "needsPin" };
  if (unlock.phase === "error") {
    return { kind: "error", message: unlock.failure ? refusalMessage(unlock.failure, t) : t("familyTv:manage.loadFailed") };
  }
  if (unlock.phase === "pin") {
    return {
      kind: "pin",
      pad: {
        profile: { id: owner.userId, name: owner.name, color: owner.color, hasPin: true, guest: false, lockedLabel: null },
        title: t("familyTv:pin.manageTitle", { name: owner.name }),
        hint: t("familyTv:pin.manageHint"),
        typed: unlock.entry.digits.length,
        phase: unlock.entry.phase,
        message: pinMessageOf(unlock.entry, input.language, Date.now(), t),
      },
    };
  }
  if (overview.error && !overview.data) return { kind: "error", message: refusalMessage(refusalOfError(overview.error), t) };
  if (!list) return { kind: "loading" };
  if (actions.view === "guest") return { kind: "guest", ...actions.guest };
  // La fiche dont le profil a disparu (retiré ailleurs) : la liste.
  if (actions.view === "profile" && input.sheetRow) {
    const state = { armedKey: input.sheet.armedKey, pending: input.sheet.pending, notice: actions.notice };
    return { kind: "profile", sheet: manageSheetView(input.sheetRow, input.serverUrl, input.language, t, state) };
  }
  if (actions.view === "guestPin" && input.sheetRow) {
    const { flow, entry, note } = input.sheet.pin;
    return { kind: "guestPin", pad: guestPinPad(input.sheetRow, flow, entry, note ?? pinMessageOf(entry, input.language, Date.now(), t), input.serverUrl, t) };
  }
  if (actions.view === "invite") {
    return { kind: "invite", query: actions.invite.query, candidates: input.candidates, more: input.more, notice: actions.notice };
  }
  return {
    kind: "list",
    subtitle: list.subtitle,
    rows: list.views,
    canCreateGuest: list.capacity.canCreateGuest,
    canInvite: list.capacity.canInvite,
    blocked: list.blocked,
    armedId: actions.armedId,
    notice: actions.notice,
  };
}
