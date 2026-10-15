import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GUEST_PARENTAL_NONE, type FamilyOverviewDto, type FamilyProfileDto } from "@tentacle-tv/shared";

/**
 * L'entrée « Contrôle parental » d'un invité dans la Famille : seulement face
 * à un serveur qui déclare `family.parentalControls`, en session personnelle,
 * pour qui gère cet invité (le propriétaire : tous ; un membre : les siens).
 * Un serveur qui ne déclare rien : aucune trace, aucune erreur.
 */
const h = vi.hoisted(() => ({ parental: false, memberParental: false, viewer: "owner-id" }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }) }));
vi.mock("@tentacle-tv/api-client", () => {
  const mutation = () => ({ mutate: () => undefined, isPending: false });
  return {
    useServerCapability: (key: string) =>
      key === "family.parentalControls" ? h.parental : key === "family.memberParental" || key === "family.roles" ? h.memberParental : false,
    useUserId: () => h.viewer,
    useCancelFamilyInvitation: mutation,
    useDeleteFamilyGuest: mutation,
    useRemoveFamilyMember: mutation,
    useSetFamilyGuestRights: mutation,
    useSetFamilyMemberRights: mutation,
    useSetFamilyMemberRole: mutation,
  };
});
vi.mock("@tentacle-tv/ui", () => ({ SettingsSection: ({ children }: { children: unknown }) => <section>{children as never}</section> }));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));
vi.mock("../useFamilyAvailability", () => ({ useFamilyAvailability: () => ({ available: true, capability: { guestRequests: false } }) }));
vi.mock("../useFamilyText", () => ({ useFamilyText: () => ({ errorText: () => "", codeText: () => "", formatDate: (iso: string) => iso }) }));
vi.mock("../FamilyAvatar", () => ({ FamilyAvatar: () => <span /> }));
vi.mock("../../profiles/avatarGallery/useAvatarGallery", () => ({ useAvatarGallery: () => ({ openGallery: () => undefined, dialog: null }) }));
vi.mock("./FamilyConfirm", () => ({ FamilyConfirm: () => null }));
vi.mock("./GuestDialog", () => ({ GuestDialog: () => null }));
vi.mock("./InviteDialog", () => ({ InviteDialog: () => null }));
vi.mock("./PinEditors", () => ({ GuestPinDialog: () => null }));
vi.mock("./GuestParentalDialog", () => ({ GuestParentalDialog: () => null }));

const { FamilySection } = await import("./FamilySection");

function profile(kind: FamilyProfileDto["kind"], userId: string, createdBy: string | null = null): FamilyProfileDto {
  return {
    userId, kind, name: userId, color: "teal", hasPin: false, imageTag: null, since: null,
    createdBy, createdByName: createdBy, rights: kind === "member" ? { createGuests: true } : null, guestRights: null,
    // Un serveur 1.30.0 rend l'état d'un membre restreignable au propriétaire (et aux parents) seulement.
    ...(kind === "member" && { parental: GUEST_PARENTAL_NONE, parentalCeiling: null }),
  };
}

function overview(role: "owner" | "member", personal = true, managing = false): FamilyOverviewDto {
  return {
    v: 2,
    switches: { families: true, guests: true },
    account: { canOwn: role === "owner", canJoin: false, reviewAccount: false, hasPin: false, personalSession: personal, managing },
    family: {
      id: "f", role, owner: { userId: "owner-id", name: "owner-id" },
      profiles: [profile("owner", "owner-id"), profile("member", "member-id"), profile("guest", "guest-owner", "owner-id"), profile("guest", "guest-member", "member-id")],
      pendingInvitations: [],
      rights: role === "owner"
        ? { manageMembers: true, createGuests: true, manageGuests: "all", manageRoles: true, manageMinors: true }
        : { manageMembers: false, createGuests: true, manageGuests: "own", manageRoles: false, manageMinors: false },
      createdAt: "2026-10-01T00:00:00Z",
      since: null,
    },
    owned: null,
    memberships: [],
    incoming: [],
    limits: { maxProfiles: 6, maxGuests: 3 },
  };
}

const entries = (html: string) => [...html.matchAll(/aria-label="familyWeb:parental\.open — ([^"]+)"/g)].map((match) => match[1]);

beforeEach(() => {
  h.parental = false;
  h.memberParental = false;
  h.viewer = "owner-id";
});

describe("« Contrôle parental » d'un invité", () => {
  it("serveur qui ne déclare rien : aucune entrée", () => {
    expect(entries(renderToStaticMarkup(<FamilySection overview={overview("owner")} />))).toEqual([]);
  });

  it("le propriétaire règle tous les invités, jamais un membre", () => {
    h.parental = true;
    expect(entries(renderToStaticMarkup(<FamilySection overview={overview("owner")} />))).toEqual(["guest-owner", "guest-member"]);
  });

  it("un membre règle ses invités seulement", () => {
    h.parental = true;
    h.viewer = "member-id";
    expect(entries(renderToStaticMarkup(<FamilySection overview={overview("member")} />))).toEqual(["guest-member"]);
  });

  it("hors session personnelle (une TV), rien", () => {
    h.parental = true;
    expect(entries(renderToStaticMarkup(<FamilySection overview={overview("owner", false)} />))).toEqual([]);
  });

  it("un profil qui gère (1.30.0, `account.managing`) : les entrées de son rôle, comme en session personnelle", () => {
    h.parental = true;
    expect(entries(renderToStaticMarkup(<FamilySection overview={overview("owner", false, true)} />))).toEqual(["guest-owner", "guest-member"]);
    h.viewer = "member-id";
    expect(entries(renderToStaticMarkup(<FamilySection overview={overview("member", false, true)} />))).toEqual(["guest-member"]);
  });
});

describe("« Contrôle parental » d'un membre mineur (1.30.0)", () => {
  it("serveur qui ne déclare pas `family.memberParental` : aucune entrée sur un membre", () => {
    h.parental = true;
    expect(entries(renderToStaticMarkup(<FamilySection overview={overview("owner")} />))).not.toContain("member-id");
  });

  it("le propriétaire règle le membre ; un simple membre, jamais", () => {
    h.memberParental = true;
    expect(entries(renderToStaticMarkup(<FamilySection overview={overview("owner")} />))).toEqual(["member-id"]);
    h.viewer = "member-id";
    expect(entries(renderToStaticMarkup(<FamilySection overview={overview("member")} />))).toEqual([]);
  });

  it("le rôle de parent : un interrupteur pour le propriétaire seulement", () => {
    h.memberParental = true;
    expect(renderToStaticMarkup(<FamilySection overview={overview("owner")} />)).toContain("familyWeb:roles.parentHint");
    h.viewer = "member-id";
    expect(renderToStaticMarkup(<FamilySection overview={overview("member")} />)).not.toContain("familyWeb:roles.parentHint");
  });
});
