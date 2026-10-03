// Les jeux de données du domaine « focus » (T3), par-dessus la base du banc
// (docs/tv-navigation/banc.md, « Jeux de données »).

/** Les réglages reco du compte, avec un filtre de plateformes (Netflix · Disney+) :
 *  la pastille `filter:remove` paraît sur la 1re rangée recommandée. */
const RECO_WITH_FILTER = {
  settings: { personalized: true, includeVigie: false, community: false, shareHistory: false, explorationBalance: 0.3, providerFilter: [8, 337] },
  vigieAvailable: false,
};

function recoFilter(data) {
  data.route("GET", /^\/api\/preferences\/reco$/, (req, res, { json }) => json(res, 200, RECO_WITH_FILTER));
}

/** Les cinq titres du héros (les cinq premières reprises), reconnaissables à leur
 *  synopsis : « Synopsis du héros 1 » à « 5 », dans l'ordre de la rotation. */
function heroSynopses(data) {
  data.list("resume").slice(0, 5).forEach((item, index) => data.patchItem(item.Id, { Overview: `Synopsis du héros ${index + 1}` }));
}

export default {
  home: {
    description: "accueil : filtre Netflix · Disney+ (pastille sur la rangée « Pour vous ») ; « Synopsis du héros N » sur les cinq reprises du héros",
    apply: (data) => {
      recoFilter(data);
      heroSynopses(data);
    },
  },
  foryou: {
    description: "« Pour vous » : filtre Netflix · Disney+ (pastille sur la 1re étagère)",
    apply: recoFilter,
  },
};
