import { describe, expect, it } from "vitest";
import { collectionActions, collectionFavoritable, groupCollectionActions, type CollectionActionContext } from "./collectionActions";

const base: CollectionActionContext = { kind: "album", favorite: false, canFavorite: true, ordered: false, atTop: false, canReorder: false };
const ids = (ctx: CollectionActionContext) => collectionActions(ctx).map((a) => a.id);

describe("collectionActions", () => {
  it("un album hors des favoris : seulement l'ajouter aux favoris", () => {
    expect(ids(base)).toEqual(["favorite"]);
  });
  it("un album favori, dans sa section ordonnée", () => {
    expect(ids({ ...base, favorite: true, ordered: true, canReorder: true })).toEqual(["unfavorite", "moveTop", "reorder"]);
  });
  it("déjà en tête : pas de « Mettre en haut » ; seul de sa section : pas de « Réordonner »", () => {
    expect(ids({ ...base, favorite: true, ordered: true, atTop: true, canReorder: false })).toEqual(["unfavorite"]);
  });
  it("serveur d'avant (favori inconnu) ou favori impossible : aucun geste de favori", () => {
    expect(ids({ ...base, favorite: undefined })).toEqual([]);
    expect(ids({ ...base, canFavorite: false })).toEqual([]);
  });
  it("ma playlist : gérer puis supprimer, en rouge", () => {
    const actions = collectionActions({ ...base, kind: "playlist", ordered: true, canReorder: true, playlist: { editable: true, isMember: false, canShareWith: true, canShareLink: false } });
    expect(actions.map((a) => a.id)).toEqual(["favorite", "moveTop", "reorder", "edit", "duplicate", "shareWith", "delete"]);
    expect(actions.find((a) => a.id === "delete")!.destructive).toBe(true);
  });
  it("une playlist reçue : personnes et quitter, jamais modifier ni supprimer", () => {
    expect(ids({ ...base, kind: "playlist", playlist: { editable: false, isMember: true, canShareWith: true, canShareLink: true } })).toEqual(["favorite", "members", "leave"]);
  });
  it("une playlist publique d'un autre (ni à moi, ni reçue) : le favori seulement", () => {
    expect(ids({ ...base, kind: "playlist", playlist: { editable: false, isMember: false, canShareWith: false, canShareLink: false } })).toEqual(["favorite"]);
  });
  it("les groupes suivent l'ordre, un séparateur entre deux", () => {
    const groups = groupCollectionActions(collectionActions({ ...base, kind: "playlist", favorite: true, ordered: true, canReorder: true, playlist: { editable: true, isMember: false, canShareWith: false, canShareLink: false } }));
    expect(groups.map((g) => g.map((a) => a.id))).toEqual([["unfavorite"], ["moveTop", "reorder"], ["edit", "duplicate"], ["delete"]]);
  });
});

describe("collectionFavoritable", () => {
  it("la bibliothèque, ou une extension qui le désigne ; rien sinon (ni référence, ni référence valide)", () => {
    expect(collectionFavoritable({ jellyfinId: "abc" })).toBe(true);
    expect(collectionFavoritable({ jellyfinId: null, external: { pluginId: "sillon", id: "rg:1" } })).toBe(true);
    expect(collectionFavoritable({ jellyfinId: null, external: null })).toBe(false);
    expect(collectionFavoritable({ jellyfinId: null })).toBe(false);
    expect(collectionFavoritable({ jellyfinId: null, external: { pluginId: "Bad Id", id: "1" } })).toBe(false);
  });
});
