import { describe, expect, it } from "vitest";
import { invitePageCsp, invitePageHtml, inviteKeyFromQuery } from "./invitePage";
import { INVITE_PAGE_TEXT, invitePageLang } from "./invitePageText";

/**
 * La page d'invitation autonome (interface web coupée) : rien du client web, la
 * clé de l'URL préremplie SANS jamais y injecter de texte, la langue du
 * navigateur, chaque refus de l'inscription avec sa phrase, et des scripts qui
 * ne s'exécutent que sous leur nonce.
 */
const NONCE = "bm9uY2UtZGUtdGVzdA==";
const page = (inviteKey = "", lang: "fr" | "en" = "fr") => invitePageHtml({ lang, inviteKey, nonce: NONCE });
const scripts = (html: string) => [...html.matchAll(/<script nonce="([^"]*)">([\s\S]*?)<\/script>/g)];

describe("la clé venue de l'URL", () => {
  it("garde une clé, espaces de bord retirés ; refuse tout le reste", () => {
    expect(inviteKeyFromQuery(" 3f2a9c01be44d7e6 ")).toBe("3f2a9c01be44d7e6");
    for (const raw of ['"><script>alert(1)</script>', "a".repeat(65), "clé avec espace", undefined, ["abc"], 42]) {
      expect(inviteKeyFromQuery(raw)).toBe("");
    }
  });

  it("préremplie ; aucun autofocus — il ferait défiler la page, et sortirait le clavier d'un téléphone", () => {
    const html = page("3f2a9c01be44d7e6");
    expect(html).toContain('id="k" class="key" name="inviteKey" value="3f2a9c01be44d7e6"');
    expect(html).not.toContain("autofocus");
    expect(scripts(html)[1][2]).toContain("preventScroll:true");
  });
});

describe("la langue", () => {
  it("?lang= l'emporte, sinon la première langue du navigateur ; l'anglais par défaut", () => {
    expect(invitePageLang("de-DE,fr;q=0.8", "fr")).toBe("fr");
    expect(invitePageLang("fr-CH,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(invitePageLang("de-DE,fr;q=0.8")).toBe("en");
    expect(invitePageLang(undefined, "es")).toBe("en");
  });

  it("le lien vers l'autre langue garde la clé", () => {
    expect(page("3f2a9c01be44d7e6", "fr")).toContain('href="/register?invite=3f2a9c01be44d7e6&amp;lang=en"');
    expect(page("", "en")).toContain('href="/register?lang=fr"');
    expect(page("", "en")).toContain("<html lang=\"en\">");
    expect(page("", "en")).toContain(INVITE_PAGE_TEXT.en.title);
  });

  it("chaque refus de l'inscription a sa phrase, dans les deux langues", () => {
    for (const lang of ["fr", "en"] as const) {
      const json = scripts(page("", lang))[0][2];
      for (const code of ["invite_invalid", "invite_exhausted", "invite_expired", "username_taken", "username_invalid", "jellyfin_unconfigured", "account_creation_failed"]) {
        expect([lang, code, json.includes(`"${code}":`)]).toEqual([lang, code, true]);
      }
    }
  });
});

describe("rien du client web, rien d'étranger", () => {
  it("aucun fichier chargé sinon le logo public ; le formulaire parle à l'API du serveur", () => {
    const html = page("3f2a9c01be44d7e6");
    expect(html).not.toMatch(/<script[^>]* src=|<link[^>]*stylesheet|\/assets\//);
    expect([...html.matchAll(/ src="([^"]+)"/g)].map((match) => match[1])).toEqual(["/tentacle-logo-pirate.svg"]);
    expect(html).toContain('<form id="f" method="post" action="/api/auth/register">');
    // Sans script, rien ne s'envoie : le bouton naît désactivé (jamais un mot de passe dans une URL).
    expect(html).toContain('<button class="go" id="go" type="submit" disabled>');
  });

  it("chaque script et le style portent le nonce, et la politique n'admet qu'eux", () => {
    const html = page();
    expect(scripts(html).map((match) => match[1])).toEqual([NONCE, NONCE]);
    expect(html).toContain(`<style nonce="${NONCE}">`);
    const csp = invitePageCsp(NONCE);
    expect(csp).toContain(`script-src 'nonce-${NONCE}'`);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("le script reste de l'ES5 qui compile (les vieux navigateurs d'un invité)", () => {
    const script = scripts(page())[1][2];
    expect(() => new Function(script)).not.toThrow();
    expect(script).not.toMatch(/=>|\blet\b|\bconst\b|`/);
  });
});
