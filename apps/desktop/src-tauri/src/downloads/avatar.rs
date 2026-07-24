//! Cache local de la photo de profil, PAR utilisateur.
//!
//! Hors ligne — ou simplement le temps d'une coupure — l'`<img>` de l'avatar
//! pointait vers Jellyfin et échouait : l'utilisateur retombait sur l'initiale
//! de son nom, dans une app qui, elle, reste parfaitement utilisable sur son
//! contenu téléchargé. Une photo de profil est un repère d'identité ; la perdre
//! au premier train qui passe sous un tunnel donne l'impression d'être
//! déconnecté alors qu'on ne l'est pas.
//!
//! Emplacement : `<app_data_dir>/avatars/<userId>.jpg`, comme la base locale et
//! pour la même raison — surtout PAS sous la racine de téléchargements, qui peut
//! pointer vers un disque externe débranché. L'avatar doit s'afficher même
//! quand ce disque n'est pas là.
//!
//! Pas de passage par le serveur loopback (`localserver`) : le fichier pèse
//! quelques dizaines de kilo-octets, la data URL suffit, et cela évite de
//! dépendre d'un serveur qui peut ne jamais démarrer en bac à sable Mac App
//! Store (entitlement `network.server`).
//!
//! ⚠️ Aucun secret : une photo de profil, rien d'autre.

use base64::Engine;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Plafond de taille. L'upload redimensionne déjà à 512 px et la lecture
/// demande `maxWidth=160` : au-delà, c'est que la source n'est pas celle qu'on
/// croit, et une data URL de plusieurs mégaoctets traverserait l'IPC à chaque
/// démarrage.
const MAX_BYTES: usize = 512 * 1024;

/// Nom de fichier sûr pour un identifiant Jellyfin.
///
/// Les identifiants sont des UUID sans tiret, mais rien ne l'impose côté
/// serveur : on n'écrit donc QUE des caractères alphanumériques, ce qui interdit
/// par construction `..`, `/`, `\` et les noms réservés de Windows. Un
/// identifiant qui ne laisse rien après ce filtre est refusé plutôt que
/// remplacé par un nom vide, qui collisionnerait entre utilisateurs.
fn safe_stem(user_id: &str) -> Result<String, String> {
    let stem: String = user_id.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
    if stem.is_empty() {
        return Err("identifiant utilisateur invalide".into());
    }
    Ok(stem)
}

fn avatar_path(app: &AppHandle, user_id: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?
        .join("avatars");
    std::fs::create_dir_all(&dir).map_err(|e| format!("create avatars/: {e}"))?;
    Ok(dir.join(format!("{}.jpg", safe_stem(user_id)?)))
}

/// Enregistre la photo (JPEG, encodé en base64 par l'appelant).
pub fn put(app: &AppHandle, user_id: &str, base64_jpeg: &str) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_jpeg)
        .map_err(|e| format!("base64: {e}"))?;
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return Err(format!("taille d'avatar hors bornes : {} octets", bytes.len()));
    }
    let path = avatar_path(app, user_id)?;
    // Écriture par fichier temporaire puis renommage : une coupure en cours
    // d'écriture laisserait sinon un JPEG tronqué, c'est-à-dire une photo de
    // profil cassée pour toutes les sessions suivantes.
    let tmp = path.with_extension("jpg.part");
    std::fs::write(&tmp, &bytes).map_err(|e| format!("write avatar: {e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("rename avatar: {e}"))?;
    Ok(())
}

/// Relit la photo en base64, ou `None` si aucune n'a jamais été mise en cache.
pub fn get(app: &AppHandle, user_id: &str) -> Result<Option<String>, String> {
    let path = avatar_path(app, user_id)?;
    match std::fs::read(&path) {
        Ok(bytes) if !bytes.is_empty() => {
            Ok(Some(base64::engine::general_purpose::STANDARD.encode(bytes)))
        }
        // Absence de fichier = cas nominal au premier lancement, pas une erreur.
        _ => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::safe_stem;

    #[test]
    fn stem_ne_garde_que_l_alphanumerique() {
        assert_eq!(safe_stem("c2e997cc19afc07f").unwrap(), "c2e997cc19afc07f");
        assert_eq!(safe_stem("a-b-c").unwrap(), "abc");
    }

    #[test]
    fn stem_neutralise_toute_traversee() {
        // Le point et la barre disparaissent : impossible de sortir du dossier.
        assert_eq!(safe_stem("../../etc/passwd").unwrap(), "etcpasswd");
        assert_eq!(safe_stem("..\\..\\win").unwrap(), "win");
    }

    #[test]
    fn stem_refuse_un_identifiant_sans_alphanumerique() {
        // Renvoyer un nom vide ferait collisionner tous ces cas entre eux.
        assert!(safe_stem("../..").is_err());
        assert!(safe_stem("").is_err());
    }
}
