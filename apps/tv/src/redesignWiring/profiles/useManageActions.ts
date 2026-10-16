import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useCancelFamilyInvitation,
  useCreateFamilyGuest,
  useDeleteFamilyGuest,
  useRemoveFamilyMember,
  useSendFamilyInvitation,
  useTentacleConfig,
} from "@tentacle-tv/api-client";
import { FAMILY_PROFILE_COLORS, normalizeGuestName, type FamilyProfileColor } from "@tentacle-tv/shared";
import { confirmBlur, confirmPress, scrubCountdownKey, type ManageRowModel, type ManageView, type ProfileRefusal } from "@tentacle-tv/tv-core";
import type { ManageNotice } from "../../redesign/screens/profiles/ManageProfilesView";
import { refusalOfError } from "../../auth/profileOpening";
import { refusalMessage } from "./profilesModel";
import { isManagePinRequired } from "./useManageUnlock";

/** La recherche part quand la saisie s'arrête — le clavier de l'Apple TV écrit lettre à lettre. */
const SEARCH_SETTLE_MS = 700;

/**
 * Les PAGES et les gestes de liste de « Gérer les profils » : la liste,
 * créer un invité, inviter un membre, la FICHE d'un profil (ses gestes :
 * `useManageSheet`) et le code d'un invité ; annuler une invitation (à double
 * appui — tv-core `confirmPress`) ; retirer un profil depuis sa fiche. Chaque
 * geste part au serveur, qui juge ; un refus se dit dans la page. La gestion
 * refermée en route (`family.manage_locked`) se rouvre par `onLocked` ; sans
 * code (`family.manage_pin_required`), `onNeedsPin`.
 */
export function useManageActions({ onLocked, onNeedsPin, onRemoved }: {
  onLocked: () => void;
  onNeedsPin: () => void;
  onRemoved: (row: ManageRowModel) => void;
}) {
  const { t } = useTranslation(["familyTv", "family"]);
  const { storage } = useTentacleConfig();
  const [view, setView] = useState<ManageView>("list");
  // La fiche ouverte : l'identifiant de sa ligne.
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ManageNotice | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestColor, setGuestColor] = useState<FamilyProfileColor>(FAMILY_PROFILE_COLORS[0]);
  const [guestError, setGuestError] = useState<string | null>(null);
  // Tenu ici : la TV tourne sur react-query v4, l'api-client est typé en v5
  // (`isLoading` / `isPending` n'existent pas dans les deux).
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());

  const createGuest = useCreateFamilyGuest();
  const deleteGuest = useDeleteFamilyGuest();
  const removeMember = useRemoveFamilyMember();
  const cancelInvite = useCancelFamilyInvitation();
  const invite = useSendFamilyInvitation();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), SEARCH_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  /** Un refus : la gestion refermée se rouvre, un code retiré entre-temps se redemande ; tout autre se dit. */
  function refused(error: unknown): ProfileRefusal {
    const refusal = refusalOfError(error);
    if (refusal.kind === "manageLocked") onLocked();
    else if (isManagePinRequired(refusal)) onNeedsPin();
    return refusal;
  }

  /** Retire la ligne : annuler une invitation (la liste), supprimer un invité ou retirer un membre (sa fiche). */
  async function runRow(row: ManageRowModel, action: "delete" | "remove" | "cancel"): Promise<boolean> {
    try {
      if (action === "delete") {
        await deleteGuest.mutateAsync(row.userId);
        // Ses réglages rangés sur l'appareil partent avec lui.
        storage.removeItem(scrubCountdownKey(row.userId));
      } else if (action === "remove") await removeMember.mutateAsync(row.userId);
      else await cancelInvite.mutateAsync(row.id);
      const key = action === "delete" ? "familyTv:manage.deleted" : action === "remove" ? "familyTv:manage.removed" : "familyTv:manage.cancelled";
      setNotice({ text: t(key, { name: row.name }), tone: "success" });
      setArmedId(null);
      setSheetId(null);
      setView("list");
      onRemoved(row);
      return true;
    } catch (error) {
      setNotice({ text: refusalMessage(refused(error), t), tone: "error" });
      return false;
    }
  }

  return {
    view,
    sheetId,
    armedId,
    notice,
    guest: { name: guestName, color: guestColor, creating, error: guestError },
    invite: { query, search, sent },
    /** Ce que la fiche dit après un geste (ou un refus). */
    say: setNotice,
    refused,
    runRow,
    openGuest: (suggested: FamilyProfileColor) => {
      setGuestName("");
      setGuestColor(suggested);
      setGuestError(null);
      setView("guest");
    },
    openInvite: () => {
      setQuery("");
      setSearch("");
      setNotice(null);
      setView("invite");
    },
    /** La fiche d'un profil, ou le code de l'invité de la fiche ouverte. */
    openSheet: (id: string) => {
      setArmedId(null);
      setNotice(null);
      setSheetId(id);
      setView("profile");
    },
    openGuestPin: () => setView("guestPin"),
    toSheet: () => setView("profile"),
    toList: () => {
      setArmedId(null);
      setView("list");
    },
    /** OK sur une ligne : une invitation s'annule à double appui ; un profil ouvre sa fiche. */
    rowPress: (row: ManageRowModel) => {
      if (row.kind !== "invitation") {
        if (row.gestures.length > 0) {
          setArmedId(null);
          setNotice(null);
          setSheetId(row.id);
          setView("profile");
        }
        return;
      }
      const step = confirmPress(armedId, row.id);
      setArmedId(step.armed);
      if (step.armed) setNotice(null);
      if (step.run) void runRow(row, "cancel");
    },
    rowBlur: (id: string) => setArmedId((current) => confirmBlur(current, id)),
    setGuestName: (name: string) => {
      setGuestName(name);
      setGuestError(null);
    },
    setGuestColor,
    submitGuest: async (): Promise<boolean> => {
      const name = normalizeGuestName(guestName);
      if (!name) {
        setGuestError(t("familyTv:guest.nameMissing"));
        return false;
      }
      if (creating) return false;
      setCreating(true);
      try {
        await createGuest.mutateAsync({ name, color: guestColor });
        setNotice({ text: t("familyTv:guest.created", { name }), tone: "success" });
        setView("list");
        return true;
      } catch (error) {
        setGuestError(refusalMessage(refused(error), t));
        return false;
      } finally {
        setCreating(false);
      }
    },
    setQuery,
    searchNow: () => setSearch(query.trim()),
    sendInvite: async (userId: string, name: string) => {
      try {
        await invite.mutateAsync(userId);
        setSent((current) => new Set([...current, userId]));
        setNotice({ text: t("familyTv:invite.sent", { name }), tone: "success" });
      } catch (error) {
        setNotice({ text: refusalMessage(refused(error), t), tone: "error" });
      }
    },
  };
}

export type ManageActions = ReturnType<typeof useManageActions>;
