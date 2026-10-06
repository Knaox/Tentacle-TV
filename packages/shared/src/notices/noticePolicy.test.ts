import { describe, expect, it } from "vitest";
import { DISMISSIBLE_HINTS } from "../help/dismissibleHints";
import {
  NOTICE_AUTO_HIDE_MS,
  NOTICE_RULES,
  canDismissForGood,
  noticeAutoHideMs,
  noticeRule,
  pickNotice,
  suppressedNotices,
  type NoticeContext,
} from "./noticePolicy";

/**
 * La politique des avertissements surgissants : public, un seul à la fois et
 * par rang, une fois par session, effacement seul des recommandations, et
 * « Ne plus afficher » seulement quand le serveur sait le retenir.
 */
const admin: NoticeContext = { isAdmin: true, closedThisSession: new Set() };

describe("avertissements surgissants", () => {
  it("ce que seul un admin peut corriger ne s'affiche qu'aux admins", () => {
    for (const rule of NOTICE_RULES) expect(rule.audience).toBe("admins");
    expect(pickNotice([{ id: "tmdbKey", active: true }], { ...admin, isAdmin: false })).toBeNull();
    expect(pickNotice([{ id: "tmdbKey", active: true }], admin)).toBe("tmdbKey");
  });

  it("un seul à la fois, par rang : la clé d'administration, puis le serveur, puis TMDB, puis l'invitation", () => {
    const all = [{ id: "tmdbKey", active: true }, { id: "serverUpdate", active: true }, { id: "adminKey", active: true }] as const;
    expect(pickNotice(all, admin)).toBe("adminKey");
    expect(pickNotice(all.slice(0, 2), admin)).toBe("serverUpdate");
    expect(pickNotice([{ id: "serverUpdate", active: false }, { id: "tmdbKey", active: true }], admin)).toBe("tmdbKey");
    expect(pickNotice([{ id: "serverNews", active: true }, { id: "tmdbKey", active: true }], admin)).toBe("tmdbKey");
    expect(pickNotice([{ id: "serverNews", active: true }], admin)).toBe("serverNews");
    expect(pickNotice([], admin)).toBeNull();
  });

  it("effacé ou fermé, il ne revient pas de la session ; le suivant prend sa place", () => {
    const candidates = [{ id: "serverUpdate", active: true }, { id: "tmdbKey", active: true }] as const;
    const context = { ...admin, closedThisSession: new Set(["serverUpdate"] as const) };
    expect(pickNotice(candidates, context)).toBe("tmdbKey");
    expect(pickNotice(candidates, { ...context, closedThisSession: new Set(["serverUpdate", "tmdbKey"] as const) })).toBeNull();
  });

  it("se tait sur la page qui règle le problème", () => {
    expect(pickNotice([{ id: "tmdbKey", active: true }], { ...admin, suppressed: new Set(["tmdbKey"] as const) })).toBeNull();
  });

  it("se tait sur la vue d'ensemble de l'administration (page exacte) et là où l'on règle le problème", () => {
    expect([...suppressedNotices("/admin")].sort()).toEqual(["adminKey", "serverNews", "serverUpdate", "tmdbKey"]);
    expect([...suppressedNotices("/admin/")].sort()).toEqual(["adminKey", "serverNews", "serverUpdate", "tmdbKey"]);
    expect([...suppressedNotices("/admin/metadata")]).toEqual(["tmdbKey"]);
    expect([...suppressedNotices("/admin/services")]).toEqual(["adminKey"]);
    expect([...suppressedNotices("/admin/sessions")]).toEqual([]);
    expect([...suppressedNotices("/admin-metadata")]).toEqual([]);
    expect([...suppressedNotices("/")]).toEqual([]);
  });

  it("une recommandation s'efface seule après 6 s ; une panne reste jusqu'à ce qu'on la ferme", () => {
    expect(NOTICE_AUTO_HIDE_MS).toBe(6000);
    expect(noticeAutoHideMs(noticeRule("tmdbKey").severity)).toBe(6000);
    expect(noticeAutoHideMs(noticeRule("serverNews").severity)).toBe(6000);
    expect(noticeAutoHideMs(noticeRule("adminKey").severity)).toBeNull();
    // Sous l'exigence du client, le serveur est bloquant : il reste.
    expect(noticeAutoHideMs(noticeRule("serverUpdate").severity)).toBeNull();
  });

  it("« Ne plus afficher » : un rappel du compte, offert seulement si le serveur sait le retenir", () => {
    for (const rule of NOTICE_RULES) {
      if (rule.hint) expect(DISMISSIBLE_HINTS).toContain(rule.hint);
    }
    expect(canDismissForGood(noticeRule("tmdbKey"), [...DISMISSIBLE_HINTS])).toBe(true);
    // Un serveur d'avant ne retient que le contrat d'origine.
    expect(canDismissForGood(noticeRule("tmdbKey"), ["trailerHelp"])).toBe(false);
    expect(canDismissForGood(noticeRule("serverNews"), undefined)).toBe(false);
    expect(canDismissForGood(noticeRule("serverNews"), [...DISMISSIBLE_HINTS])).toBe(true);
    // Une panne, un serveur sous l'exigence, ne se masquent jamais pour de bon.
    expect(canDismissForGood(noticeRule("adminKey"), [...DISMISSIBLE_HINTS])).toBe(false);
    expect(canDismissForGood(noticeRule("serverUpdate"), [...DISMISSIBLE_HINTS])).toBe(false);
  });
});
