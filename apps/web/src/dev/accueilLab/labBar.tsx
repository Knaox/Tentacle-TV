/**
 * La PROPOSITION pour « Hors ligne » et « Réglages » dans la barre du haut (brief, § 1.8 : « à
 * étudier, sans rien retirer du menu du compte »). Deux variantes, montées avec les vrais
 * groupes (`NavGroup`) et les vrais onglets (`NavTab`) — rien n'est branché : ce sont des
 * maquettes à comparer, la barre en service est celle du haut de la page.
 */

import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/csr/SquaresFour";
import type { ReactNode } from "react";

import { NavBrand } from "../../components/nav/NavBrand";
import { NavGroup } from "../../components/nav/NavGroup";
import { NavTab, TAB_CLASS, tabTone } from "../../components/nav/NavTab";

const TABS = ["Accueil", "Pour vous", "Films", "Séries", "Animation"];

function Tabs({ extra = [] }: { extra?: string[] }) {
  return (
    <>
      <NavBrand />
      <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line-subtle" />
      {[...TABS, ...extra].map((label, index) => (
        <NavTab key={label} label={label} path={`/dev/accueil?onglet=${index}`} active={false} reduced />
      ))}
      <span className={`${TAB_CLASS} ${tabTone(false)}`}>
        <SquaresFourIcon aria-hidden className="h-[17px] w-[17px]" />
        Plus
        <CaretDownIcon aria-hidden className="h-3.5 w-3.5" />
      </span>
    </>
  );
}

function Bar({ children }: { children: ReactNode }) {
  return <div className="flex h-[46px] items-center gap-2">{children}</div>;
}

const Avatar = () => (
  <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-surface-4 font-display text-[15px] font-bold text-content-primary shadow-edge">K</span>
);

function Variant({ id, title, note, children }: { id: string; title: string; note: string; children: ReactNode }) {
  return (
    <div data-lab-bar={id} className="rounded-panel bg-surface-1 p-5 shadow-edge">
      <h3 className="text-heading-3 text-content-primary">{title}</h3>
      <p className="mb-4 mt-1 max-w-[65ch] text-sm text-content-secondary">{note}</p>
      {/* Un fond d'image, pour juger le verre des groupes comme sur la bannière. */}
      <div className="rounded-card bg-gradient-to-r from-[#3b2a1c] via-[#5b4033] to-[#22303a] p-3">{children}</div>
    </div>
  );
}

export function LabBar() {
  return (
    <section data-lab-view="barre" className="row-gutter flex flex-col gap-4 pt-6">
      <h2 className="text-heading-2 text-content-primary">Hors ligne et Réglages dans la barre — proposition</h2>
      <Variant
        id="a"
        title="A — deux ronds dans le groupe « actions » (recommandée)"
        note="« Hors ligne » existe déjà au bureau (le rond des transferts, sa jauge autour) ; « Réglages » le rejoint. Un clic au lieu de deux, 40 px de plus, et la navigation garde toute sa place pour les bibliothèques. Les deux restent dans le menu du compte."
      >
        <Bar>
          <div className="flex min-w-0 flex-1"><NavGroup className="min-w-0 max-w-full" contentClassName="gap-0.5 pl-1.5 pr-1"><Tabs /></NavGroup></div>
          <NavGroup className="shrink-0">
            <span className="icon-btn" aria-hidden><DownloadSimpleIcon size={20} /></span>
            <span className="icon-btn" aria-hidden><UsersThreeIcon size={20} /></span>
            <span className="icon-btn" aria-hidden><BellIcon size={20} /></span>
            <span className="icon-btn" aria-hidden><GearSixIcon size={20} /></span>
          </NavGroup>
          <Avatar />
        </Bar>
      </Variant>
      <Variant
        id="b"
        title="B — deux onglets épinglables (le prototype)"
        note="« Hors ligne » et « Réglages » deviennent des destinations de « Personnaliser la barre », non épinglées d'office. Lisibles, mais chacun prend la place d'une bibliothèque : avec vingt bibliothèques, ils en poussent deux de plus dans « Plus »."
      >
        <Bar>
          <div className="flex min-w-0 flex-1"><NavGroup className="min-w-0 max-w-full" contentClassName="gap-0.5 pl-1.5 pr-1"><Tabs extra={["Hors ligne", "Réglages"]} /></NavGroup></div>
          <NavGroup className="shrink-0">
            <span className="icon-btn" aria-hidden><UsersThreeIcon size={20} /></span>
            <span className="icon-btn" aria-hidden><BellIcon size={20} /></span>
          </NavGroup>
          <Avatar />
        </Bar>
      </Variant>
    </section>
  );
}
