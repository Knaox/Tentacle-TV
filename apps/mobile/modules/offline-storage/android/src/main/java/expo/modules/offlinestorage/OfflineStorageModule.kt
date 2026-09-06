package expo.modules.offlinestorage

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Sur Android, l'exclusion de la sauvegarde est déclarative : les règles
 * `res/xml/offline_backup_rules.xml` et `offline_data_extraction_rules.xml`
 * écartent le dossier `files/offline`. Le module n'a donc rien à faire ici ;
 * il existe pour que le JavaScript ait la même surface sur les deux
 * plateformes.
 */
class OfflineStorageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OfflineStorage")

    Function("setExcludedFromBackup") { _: String, _: Boolean -> false }
  }
}
