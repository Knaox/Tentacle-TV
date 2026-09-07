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
 * rechargement JavaScript ne laisse pas de notification orpheline) — et la
 * finalisation des fichiers Allégé (`Mp4Finalizer`).
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

    // La finalisation d'un fichier Allégé, et son verdict — long (quelques
    // secondes par centaine de Mo) : fonction asynchrone, hors du fil
    // JavaScript.
    //
    //   `unusable` — aucun `moov` : le transfert s'est achevé avant que
    //                Jellyfin serve l'index. Aucun remux ne le répare, et s'y
    //                reprendre à trois fois ne fait qu'user la batterie : le
    //                moteur retéléchargera.
    //   `ok`       — le fichier se lit. Déjà indexé, il n'est PAS réécrit :
    //                recopier 500 Mo pour rien coûte du temps, de la batterie
    //                et le double d'espace disque le temps du remux.
    //   `failed`   — le remux d'un fichier fragmenté a échoué ; l'original
    //                reste intact et la finalisation se retentera.
    AsyncFunction("finalizeMp4") { path: String ->
      val cleaned = path.removePrefix("file://")
      when (Mp4Boxes.index(cleaned)) {
        Mp4Index.MISSING -> "unusable"
        Mp4Index.INDEXED -> "ok"
        Mp4Index.FRAGMENTED -> if (Mp4Finalizer.finalize(cleaned)) "ok" else "failed"
      }
    }

    // `MediaMuxer` écrit déjà l'entrée d'échantillon HEVC sous `hvc1`, et
    // ExoPlayer lit les deux formes : la réparation que réclame iOS n'a rien
    // à faire ici. Même surface, sans effet.
    AsyncFunction("promoteHevcTag") { _: String ->
      false
    }

    OnDestroy {
      appContext.reactContext?.let { OfflineTransferService.stop(it) }
    }
  }
}
