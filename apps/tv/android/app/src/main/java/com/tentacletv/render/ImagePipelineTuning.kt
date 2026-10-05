package com.tentacletv.render

import android.app.Application
import com.facebook.imagepipeline.core.ImagePipelineConfig
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.modules.fresco.FrescoModule

/**
 * La configuration de Fresco (les images de `<Image>`) : celle de React
 * Native, plus l'ENVOI ANTICIPÉ des textures.
 *
 * Une image décodée doit être envoyée au GPU avant d'être dessinée. Par
 * défaut, Android le fait à son PREMIER dessin, dans la synchronisation de
 * l'image en cours : quand une rangée entre à l'écran, toutes ses affiches
 * s'envoient dans la même image, qui déborde (banc `android-perf`, phase
 * « sync »). `Bitmap.prepareToDraw()`, appelé par Fresco sur son fil de
 * décodage dès qu'une image est prête (la recommandation d'Android pour un
 * décodeur), lance cet envoi tout de suite, en tâche du RenderThread entre
 * deux images : au premier dessin, la texture est déjà là. Même pixels, même
 * moment d'apparition.
 */
object ImagePipelineTuning {
  fun config(application: Application): ImagePipelineConfig {
    // `getDefaultConfigBuilder` ne lit que le contexte de l'application.
    val builder = FrescoModule.getDefaultConfigBuilder(BridgeReactContext(application))
    builder.experiment().setBitmapPrepareToDraw(true, 0, Int.MAX_VALUE, false)
    return builder.build()
  }
}
