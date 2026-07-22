//! Segments « passer l'intro / passer le générique » persistés au snapshot :
//! les trois sources interrogées par useIntroSkipper (MediaSegments natif
//! Jellyfin 10.9+, plugin intro-skipper aux formats dictionnaire et
//! timestamps) sont enregistrées BRUTES dans `meta/<itemId>/segments.json` —
//! la normalisation reste côté TS (normalizeSkipSegments, api-client), aucune
//! logique dupliquée ici. Best-effort : une source absente vaut `null`.

use std::path::Path;

/// JSON brut si les octets parsent en JSON, sinon `null` (source muette,
/// 404 plugin absent, HTML d'erreur…).
fn as_json_or_null(bytes: &Option<Vec<u8>>) -> String {
    match bytes {
        Some(b) if serde_json::from_slice::<serde_json::Value>(b).is_ok() => {
            String::from_utf8_lossy(b).into_owned()
        }
        _ => "null".to_owned(),
    }
}

/// Récupère les trois sources et écrit `segments.json`. Retourne `true` si au
/// moins une source a répondu ET que le fichier est écrit — sinon rien n'est
/// écrit (le lecteur local retombe alors sur les chapitres du DTO).
pub fn fetch_and_save(
    agent: &ureq::Agent,
    base: &str,
    token: &str,
    root: &Path,
    item_id: &str,
    is_episode: bool,
) -> bool {
    let media_segments = super::meta::fetch_to_vec(
        agent,
        &format!("{base}/MediaSegments/{item_id}?includeSegmentTypes=Intro,Outro"),
        token,
    )
    .ok();
    // Les endpoints du plugin intro-skipper n'existent que pour les épisodes.
    let (plugin_dict, plugin_ts) = if is_episode {
        (
            super::meta::fetch_to_vec(
                agent,
                &format!("{base}/Episode/{item_id}/IntroSkipperSegments"),
                token,
            )
            .ok(),
            super::meta::fetch_to_vec(
                agent,
                &format!("{base}/Episode/{item_id}/Timestamps"),
                token,
            )
            .ok(),
        )
    } else {
        (None, None)
    };

    if media_segments.is_none() && plugin_dict.is_none() && plugin_ts.is_none() {
        return false;
    }
    let body = format!(
        "{{\"mediaSegments\":{},\"pluginDict\":{},\"pluginTs\":{}}}",
        as_json_or_null(&media_segments),
        as_json_or_null(&plugin_dict),
        as_json_or_null(&plugin_ts),
    );
    super::meta::save_bytes(root, &format!("meta/{item_id}/segments.json"), body.as_bytes()).is_ok()
}
