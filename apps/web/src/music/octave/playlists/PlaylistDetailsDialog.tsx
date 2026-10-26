/**
 * Octave — « Modifier les détails » d'une playlist : son nom et, si le serveur sait la garder
 * (`music.playlistManage`), sa description. Des champs libellés, Entrée enregistre, Échap annule ; seul ce
 * qui a changé part au serveur, qui fait foi (la réponse remplace la playlist en cache).
 */

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMusicPlaylist, useServerCapability } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { Modal } from "../../../components/ui/Modal";
import { GlassButton } from "../../../components/ui/glass/GlassButton";

export const NAME_MAX = 200;
export const DESCRIPTION_MAX = 1000;

/** Ce qui part au serveur : seulement ce qui a changé ; `null` si rien, ou si le nom est vide. */
export function detailsChange(
  before: { name: string; description: string },
  after: { name: string; description: string },
  withDescription: boolean,
): { name?: string; description?: string } | null {
  const name = after.name.trim();
  if (!name) return null;
  const description = after.description.trim();
  const change = {
    ...(name !== before.name && { name }),
    ...(withDescription && description !== before.description.trim() && { description }),
  };
  return Object.keys(change).length > 0 ? change : null;
}

const fieldClass =
  "w-full rounded-xl border border-line-subtle bg-fill-subtle px-3 text-sm text-content-primary placeholder:text-content-quaternary focus:border-line-focus focus:outline-none";

interface Props {
  playlist: MusicPlaylist;
  onSave: (change: { name?: string; description?: string }) => Promise<boolean>;
  onClose: () => void;
}

export function PlaylistDetailsDialog({ playlist, onSave, onClose }: Props) {
  const { t } = useTranslation("music");
  const titleId = useId();
  const nameId = useId();
  const descriptionId = useId();
  const withDescription = useServerCapability("music.playlistManage");
  // La description n'est que dans le détail : celui de la page, déjà en cache, sinon une lecture.
  const detail = useMusicPlaylist(withDescription ? playlist.jellyfinId : null);
  const before = { name: playlist.name, description: detail.data?.description ?? "" };
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shownDescription = description ?? before.description;
  const change = detailsChange(before, { name, description: shownDescription }, withDescription && detail.isSuccess);

  const submit = async () => {
    if (!change || saving) return;
    setSaving(true);
    const ok = await onSave(change);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal open onClose={onClose} maxWidth={460} labelledBy={titleId}>
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{t("playlistManage.detailsTitle")}</h2>
        <label htmlFor={nameId} className="mt-5 block text-[13px] font-semibold text-content-secondary">{t("playlistManage.nameLabel")}</label>
        <input id={nameId} autoFocus value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} className={`${fieldClass} mt-1.5 h-11`} aria-invalid={!name.trim()} />
        {!name.trim() && <p role="alert" className="mt-1.5 text-[13px] text-status-error-fg">{t("playlistManage.nameRequired")}</p>}
        {withDescription && (
          <>
            <div className="mt-4 flex items-baseline justify-between">
              <label htmlFor={descriptionId} className="block text-[13px] font-semibold text-content-secondary">{t("playlistManage.descriptionLabel")}</label>
              <span className="text-xs tabular-nums text-content-quaternary">{t("playlistManage.descriptionCount", { count: shownDescription.length, max: DESCRIPTION_MAX })}</span>
            </div>
            <textarea
              id={descriptionId}
              value={shownDescription}
              maxLength={DESCRIPTION_MAX}
              disabled={!detail.isSuccess}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("playlistManage.descriptionPlaceholder")}
              rows={4}
              className={`${fieldClass} mt-1.5 resize-none py-2.5 leading-relaxed disabled:opacity-50`}
            />
          </>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <GlassButton
            inSurface
            onClick={onClose}
            disabled={saving}
            appearance={{ level: "regular", shape: "capsule" }}
            className="inline-flex h-11 items-center justify-center px-5 text-sm font-semibold disabled:opacity-50"
            fallbackClassName="rounded-lg border border-line-subtle bg-fill-soft text-content-primary transition hover:bg-fill-medium"
          >
            {t("playlistManage.cancel")}
          </GlassButton>
          <button
            type="submit"
            disabled={!change || saving}
            className="octave-brand-fill inline-flex h-11 cursor-pointer items-center justify-center rounded-full px-5 text-sm font-bold disabled:cursor-default disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {t("playlistManage.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
