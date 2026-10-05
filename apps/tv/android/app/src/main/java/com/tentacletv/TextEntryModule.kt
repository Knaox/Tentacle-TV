package com.tentacletv

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.views.textinput.ReactEditText

/**
 * Ouvrir le clavier système d'un champ, sur Android TV.
 *
 * Hors mode tactile (une télécommande), react-native-tvos ne montre jamais le
 * clavier sur un `focus()` venu du JS : il le CACHE, et attend un OK sur le
 * champ (`ReactEditText.requestFocusProgrammatically`). La refonte ouvre le
 * clavier depuis un bouton, comme sur Apple TV, par un champ caché : ce module
 * le montre (`ReactEditText.showKeyboard`), une fois le champ focalisé.
 */
class TextEntryModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "TextEntry"

    @ReactMethod
    fun showKeyboard(tag: Int) {
        UiThreadUtil.runOnUiThread {
            val view = UIManagerHelper.getUIManagerForReactTag(reactApplicationContext, tag)?.resolveView(tag)
            val field = view as? ReactEditText ?: return@runOnUiThread
            if (!field.isFocused) field.requestFocus()
            field.showKeyboard()
        }
    }
}
