import { useMemo, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { i18n } from "@tentacle-tv/shared";
import { DetailView, type DetailViewProps } from "../../../src/redesign/screens/detail/DetailView";
import { NoticeToast, type NoticeModel } from "../../../src/redesign/screens/overlays/NoticeToast";
import { SeasonsSheet } from "../../../src/redesign/screens/requests/SeasonsSheet";
import { ActionSheetView } from "../../../src/redesign/screens/sheet/ActionSheetView";
import type { BenchData } from "../data/benchData";
import { sagaOf } from "../data/detailSectionModels";
import { AOT_FILM, SAGA_POSTERS, absentSearchCards, absentSheetHeader, sagaWithRequests, seasonsSheet, t } from "../data/absentModels";
import { searchResponse } from "../data/searchResponses";
import { detailOf, imagesOf } from "./detailScenes";
import { SearchRequestScene } from "./searchRequestScene";
import type { BenchScene } from "./types";

/**
 * Les titres ABSENTS de la bibliothèque, et leur demande quand le serveur sait
 * en faire (garde Vigie) : la saga d'un film (« L'Attaque des Titans » : un
 * film dans la bibliothèque, quatre volets absents), la recherche « À
 * demander », la feuille des saisons, le grand panneau, les avis. Titres et
 * affiches réels ; les états de demande sont des exemples — le banc ne
 * demande jamais rien.
 */

type Saga = "plain" | "old" | "requests";

function sagaProps(data: BenchData, saga: Saga): DetailViewProps {
  return detailOf(data, AOT_FILM, {
    tweak: (props) => {
      const item = data.item(AOT_FILM);
      const base = item ? sagaOf(data, item, saga === "old" ? {} : SAGA_POSTERS) : null;
      return { ...props, saga: saga === "requests" ? sagaWithRequests(base) : base };
    },
  });
}

const BACK = () => undefined;
const HOLD = () => undefined;

function SagaScene({ data, saga, notice }: { data: BenchData; saga: Saga; notice?: () => NoticeModel }) {
  const { i18n: live } = useTranslation();
  const props = useMemo(() => sagaProps(data, saga), [data, saga, live.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => notice?.() ?? null, [notice, live.language]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <DetailView {...props} onBack={BACK} onLongPressSagaEntry={HOLD} />
      <NoticeToast notice={shown} />
    </>
  );
}

const SAGA_KEYS = ["saga:0", "saga:1", "saga:2", "saga:4"];

const sagaScene = (id: string, label: string, saga: Saga, focusKeys = SAGA_KEYS, notice?: () => NoticeModel): BenchScene => ({
  id: `absents/${id}`,
  group: "Titres absents",
  label,
  focusKeys,
  settleMs: 2200,
  images: (data) => imagesOf(sagaProps(data, saga)),
  render: (data) => <SagaScene data={data} saga={saga} notice={notice} />,
});

const notInLibrary = (): NoticeModel => ({ id: 1, kind: "info", title: t("cards:notInLibraryNotice") });
const sent = (): NoticeModel => ({ id: 2, kind: "success", title: t("cards:requestSent"), text: t("requests:followOnPhone") });
const inProgress = (): NoticeModel => ({
  id: 3,
  kind: "info",
  title: `${t("requests:stateArriving")} · ${t("requests:percent", { percent: 42 })}`,
  text: t("requests:followOnPhone"),
});

/** La recherche « marvel », la bibliothèque puis « À demander » — et ce qu'on pose dessus. */
const searchScene = (id: string, label: string, focusKeys: string[], overlay?: (data: BenchData) => ReactElement | null): BenchScene => ({
  id: `absents/${id}`,
  group: "Titres absents",
  label,
  focusKeys,
  settleMs: 2400,
  images: (data) => absentSearchCards(data).map((card) => card.posterUri).filter((uri): uri is string => !!uri),
  render: (data) => (
    <>
      <SearchRequestScene data={data} query="marvel" response={searchResponse(data, "marvel")} absent={absentSearchCards(data)} />
      {overlay?.(data) ?? null}
    </>
  ),
});

const requestLabel = () => (i18n.language.startsWith("fr") ? "Demander" : "Request");

export const ABSENT_SCENES: BenchScene[] = [
  sagaScene("saga", "Saga — volets absents grisés (sans Vigie)", "plain"),
  sagaScene("saga-ancien-serveur", "Saga — serveur sans affiches : titre et année", "old"),
  sagaScene("saga-vigie", "Saga — Vigie : en cours, en attente, demandé, libre", "requests"),
  sagaScene("avis-indisponible", "Avis — « pas disponible » (sans Vigie)", "plain", ["saga:1"], notInLibrary),
  sagaScene("avis-envoyee", "Avis — demande envoyée", "requests", ["saga:4"], sent),
  sagaScene("avis-etat", "Avis — déjà demandé : son état", "requests", ["saga:1"], inProgress),
  searchScene("recherche", "Recherche « marvel » — À demander (Vigie)", ["absent:0", "absent:2", "absent:3", "top"]),
  searchScene("panneau", "Grand panneau — un film absent", ["sheet:action:request", "sheet:close"], (data) => (
    <ActionSheetView
      header={absentSheetHeader(data, "Captain America: The Winter Soldier", t("cards:notInLibrary"))}
      actions={[{ kind: "request", label: requestLabel() }]}
      rating={null}
    />
  )),
  searchScene("panneau-deja", "Grand panneau — déjà demandé (rien à demander)", ["sheet:close"], (data) => (
    <ActionSheetView
      header={absentSheetHeader(data, "Spider-Man: Brand New Day", t("requests:statePending"))}
      actions={[]}
      rating={null}
    />
  )),
  searchScene("saisons", "Saisons — deux cochées, une demandée par un autre", ["sheet:season:1", "sheet:season:3", "sheet:apply"], () => (
    <SeasonsSheet sheet={seasonsSheet("ready", [1, 3])} />
  )),
  searchScene("saisons-vide", "Saisons — rien de coché", ["sheet:season:1"], () => <SeasonsSheet sheet={seasonsSheet("ready")} />),
  searchScene("saisons-lecture", "Saisons — lecture en cours", ["sheet:apply"], () => <SeasonsSheet sheet={seasonsSheet("loading")} />),
  searchScene("saisons-echec", "Saisons — illisibles pour l'instant", ["sheet:apply"], () => <SeasonsSheet sheet={seasonsSheet("failed")} />),
  searchScene("saisons-toutes", "Saisons — toutes déjà demandées", ["sheet:apply"], () => <SeasonsSheet sheet={seasonsSheet("none")} />),
];
