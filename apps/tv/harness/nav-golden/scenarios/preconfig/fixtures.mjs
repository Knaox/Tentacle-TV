// Les jeux de données du domaine « preconfig » (la préconfiguration de la
// barre, lot du 15/10) : ce que la base du banc ne sert pas — une connexion
// par identifiants ACCEPTÉE, qui jumelle la TV au compte du banc ; une
// famille de TROIS profils dont l'invitée ne voit que deux bibliothèques
// (ses droits). Voir README.md.

import { DUO, serveFamily } from "../../server/fakeFamily.mjs";

/** Un membre de plus, sans PIN ni photo : la cible de « Appliquer aussi à… ». */
const TOM = { ...DUO[0], userId: "banc-tom", name: "Tom", kind: "member", color: "orange", manage: null };
const GUEST_LIBRARIES = new Set(["db4c1708cbb5dd1676284a40f2950aba", "d565273fd114d77bdf349a2896867069"]); // Films, Séries

export default {
  "jumelage-ok": {
    description: "sans session : identifiant et mot de passe acceptés (le compte du banc), jeton d'appareil remis, la session de connexion révoquée",
    apply: (data) => {
      data.route("POST", /^\/api\/auth\/login$/, (req, res, { json }) =>
        json(res, 200, { AccessToken: "banc-connexion", User: { Id: "banc-user", Name: "Knaoxtest" } }));
      data.route("POST", /^\/api\/pair\/tv-token$/, (req, res, { json }) => json(res, 200, { token: "banc" }));
      data.route("POST", /^\/api\/auth\/logout$/, (req, res, { json }) => json(res, 200, { ok: true }));
    },
  },
  "famille-trois-profils": {
    description: "la Famille annoncée : le compte du banc (propriétaire), l'invitée Léa et le membre Tom, sans PIN — « Qui regarde ? »",
    apply: (data) => serveFamily(data, [...DUO, TOM]),
  },
  "invitee-deux-bibliotheques": {
    description: "l'invitée (banc-guest) ne voit que Films et Séries : ses vues Jellyfin, filtrées par ses droits",
    apply: (data) =>
      data.route("GET", /^\/api\/jellyfin\/Users\/banc-guest\/Views$/i, (req, res, { json }) => {
        const items = data.libraries().filter((library) => GUEST_LIBRARIES.has(library.id))
          .map((library) => ({ Id: library.id, Name: library.name, CollectionType: library.collectionType, Type: "CollectionFolder", ServerId: "banc" }));
        json(res, 200, { Items: items, TotalRecordCount: items.length, StartIndex: 0 });
      }),
  },
};
