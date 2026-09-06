package expo.modules.offlinestorage

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Sur Android, l'exclusion de la sauvegarde est déclarative : les règles
 * `res/xml/offline_backup_rules.xml` et `offline_data_extraction_rules.xml`
 * écartent le dossier `files/offline`. Le module n'a donc rien à faire ici ;
 * il existe pour que le JavaScript ait la même surface sur les deux
 * plateformes.
 *
 * Il porte en revanche le service de premier plan des transferts
 * (`OfflineTransferService`) : démarrage, mise à jour du corps de la
 * notification, arrêt — et arrêt d'office quand le module meurt (un
 * rechargement JavaScript ne laisse pas de notification orpheline).
 */
class OfflineStorageModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("OfflineStorage")

    Function("setExcludedFromBackup") { _: String, _: Boolean -> false }

    AsyncFunction("startTransferService") { channelName: String, title: String, body: String ->
      OfflineTransferService.start(context, channelName, title, body)
    }

    Function("updateTransferService") { body: String ->
      OfflineTransferService.update(context, body)
    }

    AsyncFunction("stopTransferService") {
      OfflineTransferService.stop(context)
    }

    OnDestroy {
      appContext.reactContext?.let { OfflineTransferService.stop(it) }
    }
  }
}
