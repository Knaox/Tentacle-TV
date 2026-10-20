import { describe, expect, it } from "vitest";
import {
  accountAccessCause, offlineTransferCause, pushProblemCause, signInProblemCause, wtProblemCause,
} from "./problemSources";

describe("codes des domaines → cause", () => {
  it.each([
    ["not_in_group", "wtRoomClosed"], ["not_host", "wtHostOnly"], ["stale_item", "wtDesync"],
    ["kicked", "wtRemoved"], ["expired", "wtRoomClosed"], ["dissolved", "wtRoomClosed"],
    ["access_revoked", "wtAccessRevoked"], ["access_denied", "wtAccessRevoked"],
    ["already_in_group", "wtAlreadyInGroup"], ["invite_gone", "wtInviteExpired"], ["group_gone", "wtRoomClosed"],
    ["not_member", "wtRoomClosed"], ["unknown_title", "wtTitleUnavailable"], ["not_elsewhere", "wtRoomClosed"],
    ["invalid", "unknown"], ["un_code_de_demain", "unknown"],
  ])("Watch Together %s → %s", (code, cause) => {
    expect(wtProblemCause(code)).toBe(cause);
  });

  it("Watch Together sans code → générique", () => {
    expect(wtProblemCause(null)).toBe("unknown");
  });

  it.each([
    ["disk-full", "storageFull"], ["unavailable", "transferSourceGone"], ["missing", "offlineFileMissing"],
    ["integrity", "offlineFileDamaged"], ["io", "transferFailed"], ["network", "transferFailed"],
    ["finalize", "transferFailed"], ["audio", "transferFailed"], ["unexpected", "transferFailed"],
    ["inconnu", "transferFailed"],
  ])("hors ligne %s → %s", (code, cause) => {
    expect(offlineTransferCause(code)).toBe(cause);
  });

  it("hors ligne : une attente du Wi-Fi n'est pas un échec", () => {
    expect(offlineTransferCause(null, "wifi")).toBe("wifiRequired");
    expect(offlineTransferCause(null, "network")).toBe("deviceOffline");
  });

  it("notifications", () => {
    expect(pushProblemCause("denied", false)).toBe("pushDenied");
    expect(pushProblemCause("granted", false)).toBe("pushUnavailable");
    expect(pushProblemCause("granted", true)).toBeNull();
    expect(pushProblemCause("undetermined", false)).toBeNull();
  });

  it.each([
    [{ status: 403, refusal: { code: "account_disabled", message: "x" } }, "accountDisabled"],
    [{ status: 403, refusal: { code: "account_locked_out", message: "x" } }, "accountLockedOut"],
    [{ status: 403, refusal: { code: "account_outside_schedule", message: "x" } }, "accountOutsideSchedule"],
    [{ status: 403, refusal: { code: "account_max_sessions", message: "x", maxSessions: 2 } }, "accountMaxSessions"],
    [{ status: 401, message: "Unauthorized" }, "wrongCredentials"],
    [{ status: 429, message: "Too many" }, "tooManyAttempts"],
    [{ status: 503, message: "{\"state\":\"migrating\"}" }, "databaseMigrating"],
    [new TypeError("Network request failed"), "serverUnreachable"],
    [{ status: 500, message: "boom" }, "jellyfinError"],
  ])("connexion %#", (error, cause) => {
    expect(signInProblemCause(error)).toBe(cause);
  });

  it("compte bloqué en cours de session", () => {
    expect(accountAccessCause({ error: "account_access", state: "disabled" })).toBe("accountDisabled");
    expect(accountAccessCause({ error: "account_access", state: "disabled", lockedOut: true })).toBe("accountLockedOut");
    expect(accountAccessCause({ error: "account_access", state: "outsideSchedule", schedules: [], nextOpening: null }))
      .toBe("accountOutsideSchedule");
    expect(accountAccessCause({ error: "other" })).toBeNull();
  });
});
