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

/** La recherche part quand la saisie s'arrête — le clavier de l'Apple TV écrit lettre à lettre. */
const SEARCH_SETTLE_MS = 700;

/**
 * Les GESTES de « Gérer les profils » : retirer, supprimer, annuler (à double
 * appui — tv-core `confirmPress`), créer un invité, inviter. Chaque geste part
 * au serveur, qui juge ; un refus se dit dans la page. La gestion refermée en
 * route (`family.manage_locked`) se rouvre par `onLocked`.
 */
export function useManageActions({ onLocked, onRemoved }: { onLocked: () => void; onRemoved: (row: ManageRowModel) => void }) {
  const { t } = useTranslation(["familyTv", "family"]);
  const { storage } = useTentacleConfig();
  const [view, setView] = useState<ManageView>("list");
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

  /** Un refus : la gestion refermée se rouvre ; tout autre se dit. */
  function refused(error: unknown): ProfileRefusal {
    const refusal = refusalOfError(error);
    if (refusal.kind === "manageLocked") onLocked();
    return refusal;
  }

  async function runRow(row: ManageRowModel): Promise<void> {
    try {
      if (row.action === "delete") {
        await deleteGuest.mutateAsync(row.userId);
        // Ses réglages rangés sur l'appareil partent avec lui.
        storage.removeItem(scrubCountdownKey(row.userId));
      } else if (row.action === "remove") await removeMember.mutateAsync(row.userId);
      else if (row.action === "cancel") await cancelInvite.mutateAsync(row.id);
      const key = row.action === "delete" ? "familyTv:manage.deleted" : row.action === "remove" ? "familyTv:manage.removed" : "familyTv:manage.cancelled";
      setNotice({ text: t(key, { name: row.name }), tone: "success" });
      onRemoved(row);
    } catch (error) {
      setNotice({ text: refusalMessage(refused(error), t), tone: "error" });
    }
  }

  return {
    view,
    armedId,
    notice,
    guest: { name: guestName, color: guestColor, creating, error: guestError },
    invite: { query, search, sent },
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
    toList: () => {
      setArmedId(null);
      setView("list");
    },
    rowPress: (row: ManageRowModel) => {
      const step = confirmPress(armedId, row.id);
      setArmedId(step.armed);
      if (step.armed) setNotice(null);
      if (step.run) void runRow(row);
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
