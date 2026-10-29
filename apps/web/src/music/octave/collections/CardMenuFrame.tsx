/**
 * Octave — le cadre d'une carte qui a un menu (album, artiste, playlist) : le clic droit et l'appui long sur la
 * carte, et le « … » en bas à droite, sous la pochette (le bouton lecture garde le coin de l'image), révélé au
 * survol — toujours là sans survol possible. Rien de plus quand le menu n'a rien à offrir.
 */

import { useState, type ReactNode } from "react";
import type { MusicShelfSubject } from "@tentacle-tv/api-client";
import { CollectionMenuButton, useCollectionContextMenu } from "./CollectionMenuButton";

type Handlers = ReturnType<typeof useCollectionContextMenu>["handlers"];

export function CardMenuFrame({ subject, children }: { subject: MusicShelfSubject; children: (handlers: Handlers) => ReactNode }) {
  const { handlers, menu } = useCollectionContextMenu(subject);
  const [open, setOpen] = useState(false);
  return (
    <div className="group/menu relative min-w-0">
      {children(handlers)}
      <div className={`absolute bottom-2 right-1 ${open ? "" : "octave-hover-reveal opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/menu:opacity-100 [@media(hover:none)]:opacity-100"}`}>
        <CollectionMenuButton subject={subject} open={open} onOpenChange={setOpen} className="h-9 w-9" />
      </div>
      {menu}
    </div>
  );
}
