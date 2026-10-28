/**
 * Octave — « Partager » une playlist : créer SON lien (un par playlist), le copier, ou ne plus partager (le
 * lien cesse aussitôt de marcher). Ouverte seulement si le serveur sait partager et que le compte en a le
 * droit (`useMusicPlaylistShare`) ; sans lien public réglé, elle le dit (le lien ne marche qu'à la maison).
 */

import { useEffect, useId, useState } from "react";
import { Check, Copy, Link2, Link2Off } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMusicPlaylistShare } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { Modal } from "../../../components/ui/Modal";
import { GlassButton } from "../../../components/ui/glass/GlassButton";
import { copyText } from "../../../lib/clipboard";

const COPIED_MS = 2_000;

export function SharePlaylistDialog({ playlist, onClose }: { playlist: MusicPlaylist; onClose: () => void }) {
  const { t } = useTranslation("musicShare");
  const titleId = useId();
  const linkId = useId();
  const share = useMusicPlaylistShare(playlist.jellyfinId);
  const [copied, setCopied] = useState(false);
  const link = share.share;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (url: string) => setCopied(await copyText(url));
  const create = async () => {
    const made = await share.create();
    if (made) await copy(made.url);
  };

  return (
    <Modal open onClose={onClose} maxWidth={500} labelledBy={titleId}>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <span className="octave-brand-fill flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-hidden>
            <Link2 className="h-5 w-5" />
          </span>
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{t("title", { name: playlist.name })}</h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-content-secondary">{t("intro")}</p>

        {link ? (
          <div className="mt-5">
            <label htmlFor={linkId} className="sr-only">{t("copy")}</label>
            <div className="flex items-center gap-2 rounded-xl border border-line-subtle bg-fill-subtle p-1.5 pl-3">
              <input id={linkId} readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-content-primary focus:outline-none" />
              <button
                type="button"
                onClick={() => void copy(link.url)}
                className="octave-brand-fill inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
            <p role="status" aria-live="polite" className="sr-only">{copied ? t("copied") : ""}</p>
            {link.reach === "local" && <p className="mt-3 rounded-lg bg-status-warning-bg px-3 py-2 text-[13px] text-status-warning-fg">{t("localOnly")}</p>}
            <p className="mt-4 text-[13px] text-content-tertiary">{t("revokeHint")}</p>
          </div>
        ) : null}
        {share.failed && <p role="alert" className="mt-4 text-[13px] text-status-error-fg">{t("failed")}</p>}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {link && (
            <GlassButton
              inSurface
              onClick={() => void share.revoke()}
              disabled={share.busy !== null}
              appearance={{ level: "regular", shape: "capsule" }}
              className="mr-auto inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-semibold text-status-error-fg disabled:opacity-50"
              fallbackClassName="rounded-lg border border-line-subtle bg-fill-soft transition hover:bg-fill-medium"
            >
              <Link2Off className="h-4 w-4" aria-hidden />
              {share.busy === "revoke" ? t("revoking") : t("revoke")}
            </GlassButton>
          )}
          <GlassButton
            inSurface
            onClick={onClose}
            appearance={{ level: "regular", shape: "capsule" }}
            className="inline-flex h-11 items-center justify-center px-5 text-sm font-semibold"
            fallbackClassName="rounded-lg border border-line-subtle bg-fill-soft text-content-primary transition hover:bg-fill-medium"
          >
            {t("close")}
          </GlassButton>
          {!link && (
            <button
              type="button"
              autoFocus
              disabled={share.loading || share.busy !== null}
              onClick={() => void create()}
              className="octave-brand-fill inline-flex h-11 cursor-pointer items-center justify-center rounded-full px-5 text-sm font-bold disabled:cursor-default disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              {share.busy === "create" ? t("creating") : t("create")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
