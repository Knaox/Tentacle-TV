/**
 * Octave — les lignes de la feuille des personnes : une personne (photo, nom, légende, une action à droite),
 * un membre géré par le propriétaire (son droit, « Retirer »), et le choix d'un droit (liste native : clavier,
 * lecteur d'écran et tactile sans rien recoder). Cibles de 44 px.
 */

import { memo } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MUSIC_PLAYLIST_MEMBER_RIGHTS, type MusicPlaylistMember, type MusicPlaylistMemberRight, type MusicPlaylistPerson } from "@tentacle-tv/shared/music";
import { UserAvatar } from "../../../../components/ui/UserAvatar";

const ICON_BUTTON =
  "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-secondary transition-colors hover:bg-fill-subtle hover:text-content-primary disabled:cursor-default disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

interface PersonRowProps {
  person: MusicPlaylistPerson;
  caption?: string;
  action?: { label: string; disabled?: boolean; onPress: () => void };
}

export const PersonRow = memo(function PersonRow({ person, caption, action }: PersonRowProps) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      <UserAvatar userId={person.userId} name={person.name} hasAvatar={person.imageTag !== null} imageTag={person.imageTag || undefined} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-content-primary">{person.name}</p>
        {caption && <p className="truncate text-[13px] text-content-tertiary">{caption}</p>}
      </div>
      {action && (
        <button type="button" aria-label={action.label} title={action.label} disabled={action.disabled} onClick={action.onPress} className={ICON_BUTTON}>
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      )}
    </li>
  );
});

interface RightSelectProps {
  value: MusicPlaylistMemberRight;
  onChange: (right: MusicPlaylistMemberRight) => void;
  label: string;
  disabled?: boolean;
}

export function RightSelect({ value, onChange, label, disabled }: RightSelectProps) {
  const { t } = useTranslation("musicPlaylistMembers");
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as MusicPlaylistMemberRight)}
      className="h-11 cursor-pointer rounded-full border border-line-subtle bg-fill-subtle px-3 text-[13px] font-medium text-content-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      {MUSIC_PLAYLIST_MEMBER_RIGHTS.map((right) => (
        <option key={right} value={right}>
          {t(`rights.${right}`)}
        </option>
      ))}
    </select>
  );
}

interface MemberRowProps {
  member: MusicPlaylistMember;
  disabled: boolean;
  onRight: (right: MusicPlaylistMemberRight) => void;
  onRemove: () => void;
}

export const MemberRow = memo(function MemberRow({ member, disabled, onRight, onRemove }: MemberRowProps) {
  const { t } = useTranslation("musicPlaylistMembers");
  return (
    <li className="flex min-h-14 flex-wrap items-center gap-3 py-2">
      <UserAvatar userId={member.userId} name={member.name} hasAvatar={member.imageTag !== null} imageTag={member.imageTag || undefined} size={36} />
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-content-primary">{member.name}</p>
      <RightSelect value={member.right} onChange={onRight} label={t("rightOf", { name: member.name })} disabled={disabled} />
      <button type="button" aria-label={t("removeMember", { name: member.name })} title={t("removeMember", { name: member.name })} disabled={disabled} onClick={onRemove} className={ICON_BUTTON}>
        <X className="h-5 w-5" aria-hidden />
      </button>
    </li>
  );
});
