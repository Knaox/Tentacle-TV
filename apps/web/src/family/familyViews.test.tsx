import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FamilyProfileDto } from "@tentacle-tv/shared";

/**
 * Les vues de la Famille rendues à plat, comme les autres bancs de
 * composants : ce qui s'affiche et quels gestes s'offrent, pas le clic.
 * `t()` rend la clé suivie de ses valeurs — un nom piégé y passe tel quel,
 * et c'est React qui doit l'échapper. Remplacés : l'avatar et les dates
 * (l'api-client tirerait une seconde copie de React).
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}${JSON.stringify(options)}` : key),
    i18n: { language: "fr" },
  }),
}));
vi.mock("./FamilyAvatar", () => ({ FamilyAvatar: ({ name }: { name: string }) => <span data-avatar={name} /> }));
vi.mock("./useFamilyText", () => ({ useFamilyText: () => ({ formatDate: (iso: string) => iso.slice(0, 10) }) }));

const { FamilyGuestTag } = await import("../components/admin/sessions/FamilyGuestTag");
const { ProfileRow } = await import("./page/ProfileRow");

const TRAP = "<b>Léa</b><img src=x onerror=alert(1)>";

function profile(kind: FamilyProfileDto["kind"], patch: Partial<FamilyProfileDto> = {}): FamilyProfileDto {
  return { userId: `${kind}-id`, kind, name: kind, color: "teal", hasPin: false, imageTag: null, since: "2026-10-04T00:00:00Z", ...patch };
}

function row(p: FamilyProfileDto, canManage = true): string {
  const noop = () => {};
  return renderToStaticMarkup(
    <ul>
      <ProfileRow profile={p} last canManage={canManage} onRemove={noop} onDeleteGuest={noop} onGuestPin={noop} />
    </ul>,
  );
}

describe("FamilyGuestTag — l'invité dans les sessions en cours", () => {
  it("dit « Invité · famille de X », le nom échappé, jamais interprété", () => {
    const html = renderToStaticMarkup(<FamilyGuestTag owner={TRAP} />);
    expect(html).toContain("guestOf");
    expect(html).toContain("&lt;b&gt;Léa&lt;/b&gt;&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
  });

  it("ne dit rien pour un compte ordinaire, ni face à un serveur d'avant la Famille", () => {
    expect(renderToStaticMarkup(<FamilyGuestTag owner={null} />)).toBe("");
    expect(renderToStaticMarkup(<FamilyGuestTag owner={undefined} />)).toBe("");
  });
});

describe("ProfileRow — les gestes du propriétaire", () => {
  it("un membre se retire, sans rien d'autre", () => {
    const html = row(profile("member"));
    expect(html).toContain("familyWeb:owned.remove");
    expect(html).not.toContain("familyWeb:owned.delete");
    expect(html).not.toContain("familyWeb:owned.setPin");
  });

  it("un invité offre son code PIN et sa suppression ; son nom reste du texte", () => {
    const html = row(profile("guest", { name: TRAP, hasPin: true }));
    expect(html).toContain("familyWeb:owned.setPin");
    expect(html).toContain("familyWeb:owned.delete");
    expect(html).toContain("familyWeb:owned.pinOn");
    expect(html).not.toContain("<img");
  });

  it("le propriétaire est « Vous », sans geste ; sans session personnelle, aucun geste", () => {
    const owner = row(profile("owner", { since: null }));
    expect(owner).toContain("familyWeb:owned.you");
    expect(owner).not.toContain("<button");
    expect(row(profile("guest"), false)).not.toContain("<button");
    expect(row(profile("member"), false)).not.toContain("<button");
  });
});
