// Les jeux de données du domaine « preconfig » (la préconfiguration de la
// barre, lot du 15/10) : ce que la base du banc ne sert pas — une connexion
// par identifiants ACCEPTÉE, qui jumelle la TV au compte du banc. Voir README.md.

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
};
