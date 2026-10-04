import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FamilyProfileDto, ProfileActions } from "@tentacle-tv/shared";

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
  return {
    userId: `${kind}-id`, kind, name: kind, color: "teal", hasPin: false, imageTag: null, since: "2026-10-04T00:00:00Z",
    createdBy: null, createdByName: null, rights: null, ...patch,
  };
}

const NONE: ProfileActions = { pin: false, remove: false, right: null };

function row(p: FamilyProfileDto, actions: ProfileActions = NONE, opts: { isSelf?: boolean; showCreator?: boolean } = {}): string {
  const noop = () => {};
  return renderToStaticMarkup(
    <ul>
      <ProfileRow
        profile={p} last isSelf={opts.isSelf ?? false} actions={actions} showCreator={opts.showCreator ?? false}
        rightPending={false} onRemove={noop} onGuestPin={noop} onRightChange={noop}
      />
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

describe("ProfileRow — la famille partagée", () => {
  it("le propriétaire retire un membre et règle son droit par un interrupteur", () => {
    const html = row(profile("member", { rights: { createGuests: false } }), { pin: false, remove: true, right: "createGuests" });
    expect(html).toContain("familyWeb:owned.remove");
    expect(html).toContain('role="switch"');
    expect(html).toContain("family:rights.createGuests");
    expect(html).not.toContain("familyWeb:owned.setPin");
  });

  it("un membre ne voit aucun bouton chez un autre membre, seulement le droit accordé", () => {
    const granted = row(profile("member", { rights: { createGuests: true } }));
    expect(granted).not.toContain("<button");
    expect(granted).toContain("family:rights.createGuests");
    expect(row(profile("member", { rights: { createGuests: false } }))).not.toContain("family:rights.createGuests");
  });

  it("un invité géré offre son PIN et sa suppression, dit qui l'a créé ; son nom reste du texte", () => {
    const html = row(
      profile("guest", { name: TRAP, hasPin: true, createdBy: "ana", createdByName: "Ana" }),
      { pin: true, remove: true, right: null },
      { showCreator: true },
    );
    expect(html).toContain("familyWeb:owned.setPin");
    expect(html).toContain("familyWeb:owned.delete");
    expect(html).toContain("family:addedBy");
    expect(html).not.toContain("<img");
  });

  it("l'invité d'un autre n'offre rien ; « Vous » ne s'offre aucun geste", () => {
    expect(row(profile("guest", { createdBy: "bob", createdByName: "Bob" }))).not.toContain("<button");
    const self = row(profile("member"), NONE, { isSelf: true });
    expect(self).toContain("familyWeb:owned.you");
    expect(self).not.toContain("<button");
  });
});
