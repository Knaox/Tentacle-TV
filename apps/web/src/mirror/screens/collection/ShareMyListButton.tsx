import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleAlert, LoaderCircle, Share2 } from "lucide-react";
import { useCreateShareLink, useMyShareLink, type ShareListKind } from "@tentacle-tv/api-client";
import { ShareLinkModal } from "../../../components/share/ShareLinkModal";
import { useToast } from "../../../contexts/ToastContext";
import { copyText } from "../../../lib/clipboard";
import { canShareNatively, shareListUrl, shareNatively } from "../../../lib/share";

type Status = "idle" | "busy" | "copied" | "failed";

/** Combien de temps « Copié ! » ou l'échec restent sur la pilule. */
const SETTLE_MS: Partial<Record<Status, number>> = { copied: 2_000, failed: 3_000 };

/**
 * « Partager ma liste » ou « Partager mes titres likés »
 * (`watchlist/ShareMyListButton` de l'app) : pilule de 36 au ton de la
 * marque — aplat `brand.soft`, liseré `brand.glow`, icône et texte
 * `brand.light`. Repérable sous le titre sans être l'action principale (pas
 * de dégradé plein). Ouvre la feuille de partage du système ; sans elle, le
 * lien part dans le presse-papiers et la pilule dit « Copié ! » un instant.
 *
 * Le lien déjà créé est lu d'avance : la feuille s'ouvre alors DANS le geste.
 * Safari refuse `share` comme `writeText` une fois ce geste retombé, et
 * l'aller-retour qui crée le lien suffit à le faire retomber. Si rien ne
 * passe, le panneau de partage prend le relais : le lien sous les yeux, et un
 * « Copier » dont l'appui est un geste neuf. Un lien impossible à créer se
 * dit sur la pilule (échec, tremblement) et dans un toast.
 */
export function ShareMyListButton({ kind = "watchlist" }: { kind?: ShareListKind }) {
  const { t } = useTranslation("common");
  const toast = useToast();
  const mine = useMyShareLink(true, kind);
  const create = useCreateShareLink(kind);
  const [status, setStatus] = useState<Status>("idle");
  const [panel, setPanel] = useState(false);
  const label = t(kind === "likes" ? "shareMyFavorites" : "shareMyList");

  useEffect(() => {
    const delay = SETTLE_MS[status];
    if (delay === undefined) return;
    const id = setTimeout(() => setStatus("idle"), delay);
    return () => clearTimeout(id);
  }, [status]);

  const deliver = async (token: string) => {
    const url = shareListUrl(token);
    // `share` part avant toute attente : c'est ce qui garde le geste.
    if (canShareNatively() && (await shareNatively({ url })) !== "failed") return setStatus("idle");
    if (await copyText(url)) return setStatus("copied");
    setStatus("idle");
    setPanel(true);
  };

  const onPress = async () => {
    if (status === "busy") return;
    setStatus("busy");
    const known = mine.data?.token;
    if (known) return deliver(known);
    try {
      const { token } = await create.mutateAsync();
      await deliver(token);
    } catch {
      setStatus("failed");
      toast.show("error", t("shareLinkError"));
    }
  };

  const brand = status === "idle" || status === "busy";
  const Icon = status === "busy" ? LoaderCircle : status === "copied" ? Check : status === "failed" ? CircleAlert : Share2;
  const text = status === "copied" ? t("linkCopied") : status === "failed" ? t("shareFailed") : label;

  return (
    <>
      <button
        type="button"
        onClick={onPress}
        disabled={status === "busy"}
        aria-busy={status === "busy" || undefined}
        className={`flex min-h-[36px] items-center gap-[7px] rounded-full border px-3.5 transition-transform duration-100 active:scale-[0.97] active:opacity-80 ${
          brand
            ? "text-brand-light"
            : status === "copied"
              ? "border-transparent bg-status-success-bg text-status-success-fg"
              : "animate-shake border-transparent bg-status-error-bg text-status-error-fg"
        }`}
        style={brand ? { background: "var(--brand-soft)", borderColor: "var(--brand-glow)" } : undefined}
      >
        <Icon size={15} aria-hidden className={status === "busy" ? "animate-spin" : undefined} />
        <span aria-live="polite" className="whitespace-nowrap text-[13px] font-semibold">{text}</span>
      </button>
      {panel && <ShareLinkModal kind={kind} onClose={() => setPanel(false)} />}
    </>
  );
}
