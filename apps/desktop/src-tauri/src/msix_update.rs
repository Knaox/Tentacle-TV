// Mise à jour MSIX via WinRT StoreContext.
// Disponible uniquement quand l'app est installée depuis le Microsoft Store
// (sinon GetDefault renvoie un context "non associé" et l'API échoue proprement).

use serde::Serialize;
use std::ffi::c_void;
use tauri::{AppHandle, Emitter, Manager};
use windows::Services::Store::{
    StoreContext, StorePackageUpdateResult, StorePackageUpdateState, StorePackageUpdateStatus,
};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Shell::IInitializeWithWindow;
use windows_core::{Interface, Ref};
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
    // HWND récupéré sur le main thread Tauri puis converti en usize pour
    // traverser spawn_blocking (HWND = *mut c_void, pas Send).
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Fenêtre principale introuvable".to_string())?;
    let hwnd_addr = window.hwnd().map_err(|e| e.to_string())?.0 as usize;

    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let hwnd = HWND(hwnd_addr as *mut c_void);

        let context = StoreContext::GetDefault().map_err(|e| e.to_string())?;

        // Win32 desktop : associer le StoreContext à la fenêtre owner pour
        // que la dialog Store puisse s'afficher. Sans ça,
        // RequestDownloadAndInstallStorePackageUpdatesAsync retourne
        // immédiatement avec OverallState=OtherError.
        let init: IInitializeWithWindow = context.cast().map_err(|e| e.to_string())?;
        unsafe {
            init.Initialize(hwnd).map_err(|e| e.to_string())?;
        }

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
        let result = op.get().map_err(|e| e.to_string())?;

        // op.get() peut retourner Ok même quand l'install a échoué (utilisateur
        // a refusé, pas de réseau, batterie faible, etc.). Sans cette check,
        // on enchaîne sur relaunch() côté JS et l'app se ferme alors que rien
        // n'a été téléchargé.
        let state = result.OverallState().map_err(|e| e.to_string())?;
        if state != StorePackageUpdateState::Completed {
            return Err(format!("Mise à jour Store échouée (état : {:?})", state));
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
