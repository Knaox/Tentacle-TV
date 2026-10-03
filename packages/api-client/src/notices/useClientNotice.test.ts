import { describe, expect, it } from "vitest";
import { DISMISSIBLE_HINTS } from "@tentacle-tv/shared";
import { noticeContent } from "./noticeContent";
import { clientNoticeOf, type ClientNoticeData } from "./useClientNotice";

/**
 * L'avertissement surgissant des clients : administrateurs seulement, un seul
 * par rang, rien tant que les rappels du compte ne sont pas lus, « Ne plus
 * afficher » seulement si le serveur sait le retenir, et le masquage du
 * serveur qui cède à une exigence plus haute.
 */
const known = [...DISMISSIBLE_HINTS];
const base: ClientNoticeData = {
  hints: { dismissed: [], marks: {}, known },
  tmdbConfigured: false,
  adminKeyState: "ok",
  closedThisSession: new Set(),
};
const admin = { isAdmin: true, serverVersion: "1.22.0", minServer: "1.23.0" };

describe("l'avertissement surgissant des clients", () => {
  it("rien pour un spectateur", () => {
    expect(clientNoticeOf({ ...admin, isAdmin: false }, base)).toBeNull();
  });

  it("le serveur d'abord, avec ses versions et l'exigence à retenir", () => {
    expect(clientNoticeOf(admin, base)).toMatchObject({
      id: "serverUpdate", canDismiss: true, mark: "1.23.0", values: { server: "1.22.0", required: "1.23.0" },
    });
  });

  it("la clé d'administration en panne passe avant tout, et ne se masque jamais", () => {
    const notice = clientNoticeOf(admin, { ...base, adminKeyState: "revoquee" });
    expect(notice).toMatchObject({ id: "adminKey", canDismiss: false, adminKeyState: "revoquee" });
    expect(clientNoticeOf(admin, { ...base, adminKeyState: "injoignable" })?.id).toBe("serverUpdate");
  });

  it("rien tant que les rappels du compte ne sont pas lus", () => {
    expect(clientNoticeOf(admin, { ...base, hints: undefined })).toBeNull();
  });

  it("masqué jusqu'à la prochaine mise à jour obligatoire, puis de retour quand l'exigence monte", () => {
    const masked = { ...base, hints: { dismissed: ["serverUpdate" as const], marks: { serverUpdate: "1.23.0" }, known } };
    expect(clientNoticeOf(admin, masked)?.id).toBe("tmdbKey");
    expect(clientNoticeOf({ ...admin, minServer: "1.24.0" }, masked)?.id).toBe("serverUpdate");
  });

  it("TMDB masqué pour de bon ; fermé dans la session ; tu sur la page qui le règle", () => {
    const upToDate = { ...admin, serverVersion: "1.23.0" };
    expect(clientNoticeOf(upToDate, base)?.id).toBe("tmdbKey");
    expect(clientNoticeOf(upToDate, { ...base, hints: { dismissed: ["tmdbKey"], marks: {}, known } })).toBeNull();
    expect(clientNoticeOf(upToDate, { ...base, closedThisSession: new Set(["tmdbKey"] as const) })).toBeNull();
    expect(clientNoticeOf({ ...upToDate, suppressed: new Set(["tmdbKey"] as const) }, base)).toBeNull();
  });

  it("un serveur qui ne sait pas retenir le masquage : l'avertissement, sans « Ne plus afficher »", () => {
    const legacy = { ...base, hints: { dismissed: [], marks: {}, known: ["trailerHelp" as const] } };
    expect(clientNoticeOf(admin, legacy)).toMatchObject({ id: "serverUpdate", canDismiss: false });
  });

  it("chaque avertissement a ses mots et son geste ; la panne de clé ne se masque pas", () => {
    const server = clientNoticeOf(admin, base);
    expect(server && noticeContent(server)).toMatchObject({ actionPath: "/admin", dismissKey: "notices:serverUpdateDismiss" });
    const key = clientNoticeOf(admin, { ...base, adminKeyState: "sansDroits" });
    const content = key && noticeContent(key);
    expect(content).toMatchObject({ textKeys: ["notices:adminKeyNoRights", "notices:adminKeyImpact"], actionPath: "/admin/services#jellyfin" });
    expect(content?.dismissKey).toBeUndefined();
  });
});
