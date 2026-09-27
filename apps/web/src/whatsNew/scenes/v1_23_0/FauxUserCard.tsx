import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { StatusPill, UserAvatar } from "../../../components/admin/kit";
import { relativeTime } from "../../../components/admin/users/userListModel";
import { Place, sceneTween, type Placed } from "..";

/**
 * Une carte de la page Utilisateurs, en faux : la photo (le VRAI `UserAvatar`
 * — la vraie photo pour le compte connecté, l'initiale pour les autres, comme
 * un compte sans photo), le nom, les pastilles, « Actif il y a… ». Même
 * anatomie que `components/admin/users/UserCard`.
 */

export interface SceneAccount {
  id: string;
  name: string;
  hasAvatar: boolean;
  imageTag?: string;
  isAdmin?: boolean;
  isSelf?: boolean;
  /** Minutes depuis la dernière activité. */
  minutesAgo: number;
  devices: number;
}

/** Le compte connecté, lu là où l'app le garde — `null` hors session (test, crochet). */
export function readSelfAccount(): Pick<SceneAccount, "id" | "name" | "hasAvatar" | "imageTag"> | null {
  try {
    const user = JSON.parse(localStorage.getItem("tentacle_user") ?? "null");
    if (!user?.Id) return null;
    return { id: user.Id, name: user.Name ?? "", hasAvatar: Boolean(user.PrimaryImageTag), imageTag: user.PrimaryImageTag };
  } catch {
    return null;
  }
}

/** « il y a 2 h », dans la langue de l'app — le même calcul que la vraie page. */
export function useAgo(minutes: number): string {
  const { t, i18n } = useTranslation("admin");
  const now = Date.now();
  return relativeTime(new Date(now - minutes * 60_000).toISOString(), now, i18n.language) ?? t("lastActivityNever");
}

interface FauxUserCardProps extends Placed {
  account: SceneAccount;
  hovered?: boolean;
}

export function FauxUserCard({ account, hovered = false, ...place }: FauxUserCardProps) {
  const { t } = useTranslation("admin");
  const ago = useAgo(account.minutesAgo);
  return (
    <Place {...place}>
      <div className="relative flex h-full items-center gap-2.5 overflow-hidden rounded-xl border border-line-subtle bg-fill-faint px-2.5">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-xl border border-line-strong bg-fill-subtle"
          initial={false}
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={sceneTween}
        />
        <UserAvatar userId={account.id} name={account.name} hasAvatar={account.hasAvatar} imageTag={account.imageTag} size={34} className="relative" />
        <span className="relative min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[12px] font-semibold text-content-primary">{account.name}</span>
            {account.isAdmin && <StatusPill tone="brand" size="sm" className="!h-4 !px-1.5 !text-[9px]">{t("userAdmin")}</StatusPill>}
            {account.isSelf && <StatusPill tone="neutral" size="sm" dot={false} className="!h-4 !px-1.5 !text-[9px]">{t("userYou")}</StatusPill>}
          </span>
          <span className="mt-0.5 block truncate text-[10px] text-content-tertiary">
            {t("userActive", { time: ago })} · {t("userDevices", { count: account.devices })}
          </span>
        </span>
        <ChevronRight aria-hidden className="relative h-3.5 w-3.5 shrink-0 text-content-quaternary" />
      </div>
    </Place>
  );
}
