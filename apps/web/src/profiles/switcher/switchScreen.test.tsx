import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PickerProfileDto, PickerProfilesDto, PickerStay } from "@tentacle-tv/shared";

/**
 * « Qui regarde ? » ouvert par « Changer de profil » plutôt qu'à l'ouverture :
 * le MÊME contrôleur, rendu à plat. Ce qui change se voit dans le balisage —
 * « Annuler » (absent à l'ouverture), la case « Ne plus proposer » décochée
 * même si l'ordinateur retient un profil, le focus sur le profil en cours.
 * Les gestes eux-mêmes sont jugés par `switchPlan.test.ts`. React Query, la
 * bascule et le stockage sont remplacés (l'api-client tirerait une seconde
 * copie de React).
 */

const state = vi.hoisted(() => ({ listing: null as PickerProfilesDto | null, stay: null as PickerStay | null }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: state.listing ?? undefined, isError: false, refetch: async () => undefined }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}${JSON.stringify(options)}` : key),
    i18n: { language: "fr" },
  }),
}));
vi.mock("@tentacle-tv/api-client", () => ({
  useJellyfinClient: () => ({ getDeviceName: () => "Desktop" }),
  TentacleApiError: class extends Error {},
}));
vi.mock("../../auth/profileSession", () => ({ accountUserId: () => "owner" }));
vi.mock("../../auth/profileEnded", () => ({ beginProfileSwitch: vi.fn(), cancelProfileSwitch: vi.fn() }));
vi.mock("../../family/FamilyAvatar", () => ({ FamilyAvatar: ({ name }: { name: string }) => <span data-avatar={name} /> }));
vi.mock("../api/pickerGateway", () => ({
  pickerProfilesKey: (accountId: string | null) => ["family", "picker", accountId ?? "none"],
  loadPickerProfiles: vi.fn(),
  pickProfile: vi.fn(),
}));
vi.mock("../switch/commitPick", () => ({ commitPick: vi.fn(), curtainOf: vi.fn() }));
vi.mock("../switch/arrival", () => ({ announceArrival: vi.fn() }));
vi.mock("../launch/stayOnDevice", () => ({
  readStayOnThisServer: () => state.stay,
  writeStayOnThisServer: vi.fn(),
}));

const { ProfileLaunchScreen } = await import("../launch/ProfileLaunchScreen");

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return { userId, kind: "member", name: userId, color: "teal", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, personal: false, ...extra };
}

const LISTING: PickerProfilesDto = {
  v: 2,
  platform: "desktop",
  switches: { families: true, guests: true },
  account: { userId: "owner", name: "Damien" },
  profiles: [profile("owner", { kind: "owner", personal: true, hasPin: true }), profile("zoe", { hasPin: true }), profile("lea", { kind: "guest" })],
  currentProfileId: "zoe",
  pickerRequired: true,
  atLaunch: true,
};

const noop = () => undefined;

function render(switching?: { activeProfileId: string | null }): string {
  return renderToStaticMarkup(
    <ProfileLaunchScreen
      initialListing={null}
      onDone={noop}
      onAccountLost={noop}
      switching={switching ? { ...switching, onCancel: noop } : undefined}
    />,
  );
}

/** La tuile dans l'ordre de tabulation : celle où le focus arrive. */
function tabbableTile(html: string): string {
  return html.match(/<button[^>]*tabindex="0"[^>]*>/)?.[0] ?? "";
}

describe("« Qui regarde ? » depuis « Changer de profil »", () => {
  beforeEach(() => {
    state.listing = LISTING;
    // L'ordinateur retient Zoé (« Ne plus proposer sur cet appareil »).
    state.stay = { profileId: "zoe", hasPin: true };
  });

  it("à l'ouverture de l'application : ni « Annuler », la case cochée d'après l'ordinateur, le focus sur son profil", () => {
    const html = render();
    expect(html).not.toContain("switcher.cancel");
    expect(html).toMatch(/<input type="checkbox"[^>]*checked=""/);
    expect(tabbableTile(html)).toContain("owner");
  });

  it("depuis la session d'un profil : « Annuler », la case décochée, le focus sur le profil en cours", () => {
    const html = render({ activeProfileId: "zoe" });
    expect(html).toContain("switcher.cancel");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('checked=""');
    expect(tabbableTile(html)).toContain("zoe");
    // « Gérer les profils » reste là : son profil d'abord, derrière son code.
    expect(html).toContain("manageProfiles");
  });

  it("depuis la session personnelle : le focus sur son propre profil", () => {
    expect(tabbableTile(render({ activeProfileId: null }))).toContain("owner");
  });

  it("préférence coupée : pas de case, « Annuler » toujours là", () => {
    state.listing = { ...LISTING, atLaunch: false };
    const html = render({ activeProfileId: null });
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("switcher.cancel");
  });

  it("la liste pas encore lue : l'attente, et déjà de quoi annuler", () => {
    state.listing = null;
    const html = render({ activeProfileId: null });
    expect(html).toContain("loading");
    expect(html).toContain("switcher.cancel");
  });
});
