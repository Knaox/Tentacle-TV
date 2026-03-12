package com.tentacletv

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule

class VoiceRecognitionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var speechRecognizer: SpeechRecognizer? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val VOICE_REQUEST_CODE = 9999
        private const val TAG = "VoiceRecognition"
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "VoiceRecognition"

    /**
     * Check if speech recognition is available via either:
     * 1. SpeechRecognizer service (standard)
     * 2. RecognizerIntent activity (fallback for Android TV / NVIDIA Shield)
     */
    @ReactMethod
    fun isAvailable(promise: Promise) {
        try {
            val context = reactApplicationContext
            val recognizerAvailable = SpeechRecognizer.isRecognitionAvailable(context)
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            val intentAvailable = intent.resolveActivity(context.packageManager) != null
            Log.d(TAG, "isAvailable: recognizerAvailable=$recognizerAvailable, intentAvailable=$intentAvailable")
            promise.resolve(recognizerAvailable || intentAvailable)
        } catch (e: Exception) {
            Log.e(TAG, "isAvailable error", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun checkPermission(promise: Promise) {
        val granted = reactApplicationContext.checkSelfPermission(
            android.Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        Log.d(TAG, "checkPermission RECORD_AUDIO: $granted")
        promise.resolve(granted)
    }

    @ReactMethod
    fun startListening(locale: String?) {
        val context = reactApplicationContext

        // Try SpeechRecognizer first (inline, no UI)
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            startInlineSpeechRecognizer(locale)
            return
        }

        // Fallback: launch system speech recognition UI (works on NVIDIA Shield via Google)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            if (!locale.isNullOrEmpty()) {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
            }
        }

        val activity = currentActivity
        if (activity != null && intent.resolveActivity(context.packageManager) != null) {
            activity.startActivityForResult(intent, VOICE_REQUEST_CODE)
        } else {
            sendEvent("onVoiceError", "Speech recognition not available")
        }
    }

    private fun startInlineSpeechRecognizer(locale: String?) {
        UiThreadUtil.runOnUiThread {
            if (speechRecognizer != null) {
                // Existing recognizer: destroy first, then recreate after delay to avoid race condition
                stopRecognizerInternal()
                mainHandler.postDelayed({ createAndStartRecognizer(locale) }, 300)
            } else {
                createAndStartRecognizer(locale)
            }
        }
    }

    private fun createAndStartRecognizer(locale: String?) {
        // Prefer Activity context (required on some Android TV devices), fallback to app context
        val ctx: Context = currentActivity ?: reactApplicationContext
        try {
            Log.d(TAG, "createAndStartRecognizer with context=${ctx.javaClass.simpleName}")
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(ctx).apply {
                setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {
                        Log.d(TAG, "onReadyForSpeech")
                        sendEvent("onListeningStarted", "ready")
                    }

                    override fun onBeginningOfSpeech() {
                        Log.d(TAG, "onBeginningOfSpeech")
                    }

                    override fun onResults(results: Bundle?) {
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = matches?.firstOrNull() ?: ""
                        Log.d(TAG, "onResults: $text")
                        sendEvent("onVoiceResult", text)
                    }

                    override fun onPartialResults(partialResults: Bundle?) {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}

                    override fun onError(error: Int) {
                        val msg = when (error) {
                            SpeechRecognizer.ERROR_NO_MATCH -> "No match found"
                            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Speech timeout"
                            SpeechRecognizer.ERROR_AUDIO -> "Audio error"
                            SpeechRecognizer.ERROR_NETWORK -> "Network error"
                            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Missing RECORD_AUDIO permission"
                            SpeechRecognizer.ERROR_CLIENT -> "Client error"
                            SpeechRecognizer.ERROR_SERVER -> "Server error"
                            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer busy"
                            else -> "Recognition error ($error)"
                        }
                        Log.w(TAG, "onError: $msg (code=$error)")
                        sendEvent("onVoiceError", msg)
                    }

                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
            }

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 5000L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
                if (!locale.isNullOrEmpty()) {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
                }
            }

            speechRecognizer?.startListening(intent)
        } catch (e: Exception) {
            Log.e(TAG, "createAndStartRecognizer error", e)
            sendEvent("onVoiceError", "Failed to start speech recognizer")
        }
    }

    @ReactMethod
    fun stopListening() {
        UiThreadUtil.runOnUiThread {
            speechRecognizer?.stopListening()
        }
    }

    private fun stopRecognizerInternal() {
        mainHandler.removeCallbacksAndMessages(null)
        speechRecognizer?.destroy()
        speechRecognizer = null
    }

    private fun sendEvent(eventName: String, data: String) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, data)
    }

    // ActivityEventListener — handle result from fallback intent and permission requests
    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == VOICE_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                val matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                val text = matches?.firstOrNull() ?: ""
                sendEvent("onVoiceResult", text)
            } else {
                sendEvent("onVoiceError", "Speech recognition cancelled")
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        // Not needed
    }

    override fun onCatalystInstanceDestroy() {
        UiThreadUtil.runOnUiThread {
            stopRecognizerInternal()
        }
        super.onCatalystInstanceDestroy()
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN event emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN event emitter
    }
}
