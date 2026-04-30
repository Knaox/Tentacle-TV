// Mise à jour MSIX via WinRT StoreContext.
// Disponible uniquement quand l'app est installée depuis le Microsoft Store
// (sinon GetDefault renvoie un context "non associé" et l'API échoue proprement).

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use windows::Services::Store::{
    StoreContext, StorePackageUpdateResult, StorePackageUpdateStatus,
};
use windows_core::Ref;
use windows_future::AsyncOperationProgressHandler;

#[derive(Serialize, Clone)]
pub struct MsixUpdateInfo {
    pub version: String,
    pub mandatory: bool,
}

#[derive(Serialize, Clone)]
pub struct MsixProgress {
    pub progress: f64, // 0.0 .. 1.0
}

#[tauri::command]
pub async fn check_msix_update() -> Result<Option<MsixUpdateInfo>, String> {
    tauri::async_runtime::spawn_blocking(|| -> Result<Option<MsixUpdateInfo>, String> {
        let context = StoreContext::GetDefault().map_err(|e| e.to_string())?;
        let updates = context
            .GetAppAndOptionalStorePackageUpdatesAsync()
            .map_err(|e| e.to_string())?
            .get()
            .map_err(|e| e.to_string())?;

        if updates.Size().map_err(|e| e.to_string())? == 0 {
            return Ok(None);
        }

        let first = updates.GetAt(0).map_err(|e| e.to_string())?;
        let pkg = first.Package().map_err(|e| e.to_string())?;
        let id = pkg.Id().map_err(|e| e.to_string())?;
        let v = id.Version().map_err(|e| e.to_string())?;
        let mandatory = first.Mandatory().unwrap_or(false);

        Ok(Some(MsixUpdateInfo {
            version: format!("{}.{}.{}.{}", v.Major, v.Minor, v.Build, v.Revision),
            mandatory,
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn download_and_install_msix_update(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let context = StoreContext::GetDefault().map_err(|e| e.to_string())?;
        let updates = context
            .GetAppAndOptionalStorePackageUpdatesAsync()
            .map_err(|e| e.to_string())?
            .get()
            .map_err(|e| e.to_string())?;

        if updates.Size().map_err(|e| e.to_string())? == 0 {
            return Err("Aucune mise à jour MSIX disponible".to_string());
        }

        let op = context
            .RequestDownloadAndInstallStorePackageUpdatesAsync(&updates)
            .map_err(|e| e.to_string())?;

        let app_for_progress = app.clone();
        let handler = AsyncOperationProgressHandler::<
            StorePackageUpdateResult,
            StorePackageUpdateStatus,
        >::new(move |_sender, progress: Ref<StorePackageUpdateStatus>| {
            if let Some(s) = progress.as_ref() {
                let _ = app_for_progress.emit(
                    "msix-update-progress",
                    MsixProgress {
                        progress: s.PackageDownloadProgress,
                    },
                );
            }
            Ok(())
        });
        op.SetProgress(&handler).map_err(|e| e.to_string())?;

        // Bloque jusqu'à fin du téléchargement+stage. L'install effective
        // se fait au prochain launch (contrainte MSIX : pas de remplacement
        // de fichiers d'une app en cours d'exécution).
        let _result = op.get().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
