import type { TFunction } from "i18next";
import { manageSheetKey, type ManageGesture, type ManageRowModel, type OwnPinFlow, type PinEntry } from "@tentacle-tv/tv-core";
import type { ManageNotice, ManageSheetView, SheetRowView } from "../../redesign/screens/profiles/ManageProfilesView";
import type { PinPadModel } from "../../redesign/screens/profiles/profilesTypes";
import { profileAvatarUri } from "./profilesModel";
import { rowDetail, type PendingRight } from "./manageModel";

/**
 * Ce que la FICHE d'un profil montre, d'après ses gestes (tv-core
 * `familyManageSheet`) : une ligne par geste, dans l'ordre du modèle, avec
 * les mots de l'espace `familyTv`. Le geste à double appui armé (`armedKey`)
 * dit ce qui va se passer ; un réglage en cours d'envoi (`pending`) montre
 * déjà son nouvel état.
 */

export interface SheetState {
  armedKey: string | null;
  pending: PendingRight;
  notice: ManageNotice | null;
}

function toggleValue(key: string, on: boolean, pending: PendingRight): boolean {
  return pending?.key === key ? pending.on : on;
}

function rowsOf(gesture: ManageGesture, name: string, t: TFunction, state: SheetState): SheetRowView[] {
  switch (gesture.kind) {
    case "photo":
      return [{ key: manageSheetKey("photo"), kind: "action", icon: "user", title: t("familyTv:sheet.photo"), description: t("familyTv:sheet.photoHint"), opens: true }];
    case "pin": {
      if (!gesture.hasPin) {
        const key = manageSheetKey("pin", "create");
        return [{ key, kind: "action", icon: "lock", title: t("familyTv:sheet.pinCreate"), description: t("familyTv:sheet.pinHint"), state: t("familyTv:ownPin.off"), opens: true }];
      }
      const remove = manageSheetKey("pin", "remove");
      const armed = state.armedKey === remove;
      return [
        { key: manageSheetKey("pin", "change"), kind: "action", icon: "lock", title: t("familyTv:sheet.pinChange"), description: t("familyTv:sheet.pinHint"), state: t("familyTv:ownPin.on"), opens: true },
        {
          key: remove,
          kind: "action",
          icon: "close",
          title: armed ? t("familyTv:sheet.pinRemoveConfirm") : t("familyTv:ownPin.remove"),
          description: armed ? t("familyTv:sheet.pinRemoveHint", { name }) : undefined,
          armed,
        },
      ];
    }
    case "requestTitles": {
      const key = manageSheetKey("requestTitles");
      return [{ key, kind: "toggle", icon: "inboxIn", title: t("familyTv:manage.canRequestTitles"), description: t("familyTv:sheet.requestHint"), value: toggleValue(key, gesture.on, state.pending) }];
    }
    case "parentRole": {
      const key = manageSheetKey("parentRole");
      const description = t(gesture.blocked ? "familyTv:sheet.parentBlocked" : "familyTv:sheet.parentHint");
      return [{ key, kind: "toggle", icon: "user", title: t("familyTv:sheet.parent"), description, value: toggleValue(key, gesture.on, state.pending) }];
    }
    case "createGuests": {
      const key = manageSheetKey("createGuests");
      return [{ key, kind: "toggle", icon: "plus", title: t("familyTv:manage.canCreateGuests"), description: t("familyTv:sheet.createGuestsHint"), value: toggleValue(key, gesture.on, state.pending) }];
    }
    case "parental":
      return [{ key: manageSheetKey("parental"), kind: "action", icon: "eyeOff", title: t("familyTv:sheet.parental"), description: t("familyTv:sheet.parentalHint"), opens: true }];
    case "delete":
    case "remove": {
      const key = manageSheetKey(gesture.kind);
      const armed = state.armedKey === key;
      const words = gesture.kind === "delete"
        ? { title: "familyTv:sheet.delete", armed: "familyTv:manage.deleteConfirm", caption: "familyTv:sheet.deleteCaption", hint: "familyTv:manage.deleteHint" }
        : { title: "familyTv:sheet.remove", armed: "familyTv:manage.removeConfirm", caption: "familyTv:sheet.removeCaption", hint: "familyTv:manage.removeHint" };
      return [{
        key,
        kind: "action",
        icon: gesture.kind === "delete" ? "close" : "logout",
        title: t(armed ? words.armed : words.title),
        description: t(armed ? words.hint : words.caption, { name }),
        tone: "danger",
        armed,
      }];
    }
  }
}

export function manageSheetView(
  row: ManageRowModel,
  serverUrl: string | null,
  language: string,
  t: TFunction,
  state: SheetState,
): ManageSheetView {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    avatarUri: profileAvatarUri(serverUrl, row.userId, row.imageTag),
    detail: rowDetail(row, language, t),
    rows: row.gestures.flatMap((gesture) => rowsOf(gesture, row.name, t, state)),
    notice: state.notice,
  };
}

/** Le pavé du code d'un invité : le nouveau, puis sa confirmation (aucun code actuel à taper). */
export function guestPinPad(row: ManageRowModel, flow: OwnPinFlow, entry: PinEntry, note: string | null, serverUrl: string | null, t: TFunction): PinPadModel {
  return {
    profile: {
      id: row.userId,
      name: row.name,
      color: row.color ?? "violet",
      avatarUri: profileAvatarUri(serverUrl, row.userId, row.imageTag),
      hasPin: row.hasPin,
      guest: true,
      lockedLabel: null,
    },
    title: t(flow.step === "confirm" ? "familyTv:sheet.pinConfirmTitle" : "familyTv:sheet.pinNewTitle", { name: row.name }),
    hint: t("familyTv:sheet.pinHint"),
    typed: entry.digits.length,
    phase: entry.phase,
    message: flow.mismatch ? t("familyTv:ownPin.mismatch") : note,
  };
}
