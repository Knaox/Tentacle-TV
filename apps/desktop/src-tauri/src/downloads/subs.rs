//! Sous-titres texte en side-cars : téléchargés via le proxy (conversion de
//! format assurée par Jellyfin — srt/ass/vtt), enregistrés sous
//! `media/<itemId>/subs/`. Les sous-titres image (PGS/VobSub) ne sont PAS
//! convertibles en texte : hors ligne, ils n'existent qu'incrustés (burn-in)
//! dans une variante Allégée. Best-effort : un sous-titre manquant ne bloque
//! jamais le média.

use super::fsops;
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::Path;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleSpec {
    /// Index du MediaStream côté Jellyfin.
    pub index: i64,
    /// Format cible : srt | ass | vtt (validé ici).
    pub format: String,
    /// Étiquette de fichier pré-construite côté client (ex. "fre-forced") —
    /// re-sanitisée par prudence.
    pub lang_tag: String,
}

fn sanitize_tag(tag: &str) -> String {
    let cleaned: String = tag
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(40)
        .collect();
    if cleaned.is_empty() { "und".into() } else { cleaned.to_ascii_lowercase() }
}

fn valid_format(format: &str) -> bool {
    matches!(format, "srt" | "ass" | "vtt")
}

pub fn parse_specs(json: &str) -> Vec<SubtitleSpec> {
    serde_json::from_str::<Vec<SubtitleSpec>>(json).unwrap_or_default()
}

/// Télécharge chaque sous-titre texte. Retourne le nombre récupéré.
pub fn fetch_all(
    agent: &ureq::Agent,
    server_url: &str,
    token: &str,
    root: &Path,
    item_id: &str,
    media_source_id: &str,
    specs: &[SubtitleSpec],
) -> usize {
    let mut fetched = 0;
    for spec in specs {
        if !valid_format(&spec.format) || spec.index < 0 {
            continue;
        }
        let rel = format!(
            "media/{item_id}/subs/{}-{}.{}",
            spec.index,
            sanitize_tag(&spec.lang_tag),
            spec.format
        );
        let Ok(path) = fsops::safe_join(root, &rel) else { continue };
        if path.exists() {
            fetched += 1;
            continue;
        }
        let url = format!(
            "{server_url}/api/jellyfin/Videos/{item_id}/{media_source_id}/Subtitles/{}/Stream.{}",
            spec.index, spec.format
        );
        let Ok(response) = agent
            .get(&url)
            .set("Authorization", &format!("Bearer {token}"))
            .call()
        else {
            continue;
        };
        let mut bytes = Vec::new();
        if response
            .into_reader()
            .take(15 * 1024 * 1024)
            .read_to_end(&mut bytes)
            .is_err()
            || bytes.is_empty()
        {
            continue;
        }
        if let Some(parent) = path.parent() {
            if std::fs::create_dir_all(parent).is_err() {
                continue;
            }
        }
        if std::fs::write(&path, &bytes).is_ok() {
            fetched += 1;
        }
    }
    fetched
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitisation_des_etiquettes() {
        assert_eq!(sanitize_tag("fre-forced"), "fre-forced");
        assert_eq!(sanitize_tag("../evil/FR"), "evilfr");
        assert_eq!(sanitize_tag(""), "und");
        assert!(sanitize_tag(&"x".repeat(100)).len() <= 40);
    }

    #[test]
    fn parse_specs_tolere_le_json_invalide() {
        assert!(parse_specs("pas du json").is_empty());
        let specs = parse_specs(r#"[{"index":3,"format":"srt","langTag":"fre"}]"#);
        assert_eq!(specs.len(), 1);
        assert_eq!(specs[0].index, 3);
        assert_eq!(specs[0].format, "srt");
    }
}
