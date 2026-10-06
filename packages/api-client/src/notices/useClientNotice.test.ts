import { describe, expect, it } from "vitest";
import { DISMISSIBLE_HINTS, SERVER_CAPABILITY_KEYS } from "@tentacle-tv/shared";
import { noticeContent } from "./noticeContent";
import { clientNoticeOf, type ClientNoticeData } from "./useClientNotice";

/**
 * L'avertissement surgissant des clients : administrateurs seulement, un seul
 * par rang, rien tant que les rappels du compte ne sont pas lus, « Ne plus
 * afficher » seulement si le serveur sait le retenir ; le serveur sous
 * l'exigence est bloquant, l'invitation aux nouveautés se masque jusqu'aux
 * suivantes.
 */
const known = [...DISMISSIBLE_HINTS];
const base: ClientNoticeData = {
  hints: { dismissed: [], marks: {}, known },
  tmdbConfigured: false,
  adminKeyState: "ok",
  closedThisSession: new Set(),
  capabilities: new Set(SERVER_CAPABILITY_KEYS),
};
const admin = { isAdmin: true, serverVersion: "1.22.0", minServer: "1.23.0" };

describe("l'avertissement surgissant des clients", () => {
  it("rien pour un spectateur", () => {
    expect(clientNoticeOf({ ...admin, isAdmin: false }, base)).toBeNull();
  });

  it("le serveur sous l'exigence d'abord, avec ses versions — bloquant, jamais masquable", () => {
    expect(clientNoticeOf(admin, base)).toMatchObject({
      id: "serverUpdate", canDismiss: false, values: { server: "1.22.0", required: "1.23.0" },
    });
    const masked = { ...base, hints: { dismissed: ["serverUpdate" as const], marks: { serverUpdate: "9.0.0" }, known } };
    expect(clientNoticeOf(admin, masked)?.id).toBe("serverUpdate");
  });

  it("la clé d'administration en panne passe avant tout, et ne se masque jamais", () => {
    const notice = clientNoticeOf(admin, { ...base, adminKeyState: "revoquee" });
    expect(notice).toMatchObject({ id: "adminKey", canDismiss: false, adminKeyState: "revoquee" });
    expect(clientNoticeOf(admin, { ...base, adminKeyState: "injoignable" })?.id).toBe("serverUpdate");
  });

  it("rien de masquable tant que les rappels du compte ne sont pas lus ; l'obligatoire n'attend pas", () => {
    expect(clientNoticeOf({ ...admin, serverVersion: "1.23.0" }, { ...base, hints: undefined })).toBeNull();
    expect(clientNoticeOf(admin, { ...base, hints: undefined })?.id).toBe("serverUpdate");
  });

  it("à l'exigence, une nouveauté qui attend le serveur : l'invitation, après TMDB, masquable jusqu'aux suivantes", () => {
    const current = { ...admin, serverVersion: "1.23.0" };
    const older = { ...base, tmdbConfigured: true, capabilities: new Set<never>() };
    expect(clientNoticeOf(current, older)).toMatchObject({ id: "serverNews", canDismiss: true, mark: "1.24.0" });
    expect(clientNoticeOf(current, { ...older, tmdbConfigured: false })?.id).toBe("tmdbKey");
    expect(clientNoticeOf(current, { ...older, hints: { dismissed: ["serverUpdate"], marks: { serverUpdate: "1.24.0" }, known } })).toBeNull();
    // Les capacités pas encore lues : rien, plutôt qu'une invitation qui disparaît aussitôt.
    expect(clientNoticeOf(current, { ...older, capabilities: undefined })).toBeNull();
    // Un serveur à jour : rien à proposer.
    expect(clientNoticeOf(current, { ...older, capabilities: new Set(SERVER_CAPABILITY_KEYS) })).toBeNull();
  });

  it("TMDB masqué pour de bon ; fermé dans la session ; tu sur la page qui le règle", () => {
    const upToDate = { ...admin, serverVersion: "1.23.0" };
    expect(clientNoticeOf(upToDate, base)?.id).toBe("tmdbKey");
    expect(clientNoticeOf(upToDate, { ...base, hints: { dismissed: ["tmdbKey"], marks: {}, known } })).toBeNull();
    expect(clientNoticeOf(upToDate, { ...base, closedThisSession: new Set(["tmdbKey"] as const) })).toBeNull();
    expect(clientNoticeOf({ ...upToDate, suppressed: new Set(["tmdbKey"] as const) }, base)).toBeNull();
  });

  it("un serveur qui ne sait pas retenir le masquage : l'invitation, sans « Ne plus afficher »", () => {
    const legacy = { ...base, tmdbConfigured: true, capabilities: new Set<never>(), hints: { dismissed: [], marks: {}, known: ["trailerHelp" as const] } };
    expect(clientNoticeOf({ ...admin, serverVersion: "1.23.0" }, legacy)).toMatchObject({ id: "serverNews", canDismiss: false });
  });

  it("chaque avertissement a ses mots et son geste ; la panne de clé ne se masque pas", () => {
    const server = clientNoticeOf(admin, base);
    expect(server && noticeContent(server)).toMatchObject({ actionPath: "/admin", textKeys: ["notices:serverUpdateText"] });
    expect(server && noticeContent(server).dismissKey).toBeUndefined();
    const news = clientNoticeOf({ ...admin, serverVersion: "1.23.0" }, { ...base, tmdbConfigured: true, capabilities: new Set() });
    expect(news && noticeContent(news)).toMatchObject({ textKeys: ["notices:serverNewsText"], dismissKey: "notices:serverNewsDismiss" });
    const key = clientNoticeOf(admin, { ...base, adminKeyState: "sansDroits" });
    const content = key && noticeContent(key);
    expect(content).toMatchObject({ textKeys: ["notices:adminKeyNoRights", "notices:adminKeyImpact"], actionPath: "/admin/services#jellyfin" });
    expect(content?.dismissKey).toBeUndefined();
  });
});
