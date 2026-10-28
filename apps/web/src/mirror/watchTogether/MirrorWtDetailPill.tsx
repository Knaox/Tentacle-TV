import { memo, useState } from "react";
import { Users } from "lucide-react";
import type { MediaItem } from "@tentacle-tv/shared";
import { useWtDetailAction } from "../../watchTogether/useWtDetailAction";

/**
 * « Regarder ensemble » sur la fiche du miroir — `WtDetailPill` de l'app : une
 * pilule SECONDAIRE sous la bande-annonce, au gabarit de celle-ci (48 de haut,
 * 420 au plus). La règle est celle de la capsule du bureau
 * (`useWtDetailAction`) : créer le groupe avec ce titre, y inviter en hôte, ou
 * « Rejoindre ici » ; rien pour un membre ni sans droit de créer.
 */
export const MirrorWtDetailPill = memo(function MirrorWtDetailPill({ item, maxWidth }: { item: MediaItem; maxWidth: number }) {
  const action = useWtDetailAction(item);
  const [busy, setBusy] = useState(false);
  if (!action) return null;
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={() => {
        setBusy(true);
        void action.run().finally(() => setBusy(false));
      }}
      className="mirror-detail-fade-press flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-line-subtle bg-fill-subtle px-5 text-content-primary disabled:opacity-70"
      style={{ maxWidth, WebkitTapHighlightColor: "transparent" }}
      data-wt-detail-action
    >
      {busy ? (
        <span aria-hidden className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/30 border-t-white" />
      ) : (
        <Users size={18} aria-hidden />
      )}
      <span className="truncate text-[15px] font-semibold tracking-[0.2px]">{action.label}</span>
    </button>
  );
});
