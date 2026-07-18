import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShareLinkModal } from "./ShareLinkModal";

/** Bouton « Partager ma liste » — ouvre le modal de lien de partage. */
export function ShareMyListButton() {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full bg-fill-subtle px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
      >
        <ShareIcon className="h-4 w-4" />
        {t("common:shareMyList")}
      </button>
      {open && <ShareLinkModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
      />
    </svg>
  );
}
