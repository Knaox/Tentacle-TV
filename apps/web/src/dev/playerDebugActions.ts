/**
 * Les actions du menu de débogage — DÉVELOPPEMENT UNIQUEMENT.
 *
 * Rangées par groupe (`debugMenu/`) : le lecteur, l'image et le HDR, l'application, le réseau.
 * Chaque action dit ce qu'elle fait, où elle en est, et si elle PEUT agir sur cette coquille —
 * Electron (la référence), CEF, ou un navigateur. Le tableau des trois coquilles est tenu dans
 * `apps/desktop-cef/docs/PARITE-ELECTRON.md`, « Le menu de débogage ».
 */

import { APP_ACTIONS } from "./debugMenu/debugActionsApp";
import { DISPLAY_ACTIONS } from "./debugMenu/debugActionsDisplay";
import { PLAYER_ACTIONS } from "./debugMenu/debugActionsPlayer";
import type { DebugAction } from "./debugMenu/debugActionTypes";

export type { DebugAction, DebugStatus } from "./debugMenu/debugActionTypes";

export const DEBUG_ACTIONS: readonly DebugAction[] = [...PLAYER_ACTIONS, ...DISPLAY_ACTIONS, ...APP_ACTIONS];
