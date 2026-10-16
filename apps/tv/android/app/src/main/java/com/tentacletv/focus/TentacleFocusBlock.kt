package com.tentacletv.focus

import android.content.Context
import android.view.ViewGroup
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

/**
 * Une `View` dont AUCUN descendant ne prend le focus (`FOCUS_BLOCK_DESCENDANTS`),
 * et qui ne le prend pas elle-même — la vidéo de l'aperçu au focus d'une carte
 * y est posée (`previewVideoShield.android.tsx`).
 *
 * Le `PlayerView` de react-native-video porte un contrôleur (`PlayerControlView`)
 * dont le bouton Lecture réclame le focus quand il s'affiche
 * (`requestPlayPauseFocus`) : le focus quittait la carte au premier plan de
 * l'aperçu, puis retombait sur le premier focalisable de l'écran (le héros)
 * quand le contrôleur se masquait — et une vidéo gardée en pause le réaffichait,
 * en boucle (lot ba1016, 16/10). Ici, `requestFocus` d'un descendant échoue :
 * le focus reste à la carte, qui porte la vidéo.
 */
class TentacleFocusBlock(context: Context) : ReactViewGroup(context) {
  init {
    block()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    block()
  }

  private fun block() {
    descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
    isFocusable = false
  }
}

class TentacleFocusBlockManager : ReactViewManager() {
  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = TentacleFocusBlock(context)

  companion object {
    const val NAME = "TentacleFocusBlock"
  }
}
