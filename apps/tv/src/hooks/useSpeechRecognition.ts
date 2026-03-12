import { useCallback, useEffect, useRef, useState } from "react";
import { NativeModules, DeviceEventEmitter, PermissionsAndroid, Platform } from "react-native";

const { VoiceRecognition } = NativeModules;

interface UseSpeechRecognitionOptions {
  onResult: (text: string) => void;
  locale?: string;
}

interface UseSpeechRecognition {
  isListening: boolean;
  isPending: boolean;
  isAvailable: boolean;
  startListening: () => void;
  stopListening: () => void;
}

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (granted) return true;
  console.log("[VoiceRecognition] Requesting RECORD_AUDIO permission...");
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  console.log("[VoiceRecognition] Permission result:", result);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function useSpeechRecognition({ onResult, locale }: UseSpeechRecognitionOptions): UseSpeechRecognition {
  const [isListening, setIsListening] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    console.log("[VoiceRecognition] NativeModule:", VoiceRecognition ? "found" : "NULL");
    if (!VoiceRecognition) return;
    VoiceRecognition.isAvailable()
      .then((available: boolean) => {
        console.log("[VoiceRecognition] isAvailable:", available);
        setIsAvailable(available);
      })
      .catch((err: unknown) => {
        console.warn("[VoiceRecognition] isAvailable error:", err);
        setIsAvailable(false);
      });
  }, []);

  useEffect(() => {
    if (!VoiceRecognition) return;

    const listeningSub = DeviceEventEmitter.addListener("onListeningStarted", () => {
      console.log("[VoiceRecognition] onListeningStarted received");
      setIsPending(false);
      setIsListening(true);
    });

    const resultSub = DeviceEventEmitter.addListener("onVoiceResult", (text: string) => {
      console.log("[VoiceRecognition] onVoiceResult:", text);
      setIsPending(false);
      setIsListening(false);
      if (text) onResultRef.current(text);
    });

    const errorSub = DeviceEventEmitter.addListener("onVoiceError", (msg: string) => {
      console.warn("[VoiceRecognition] onVoiceError:", msg);
      setIsPending(false);
      setIsListening(false);
    });

    return () => {
      listeningSub.remove();
      resultSub.remove();
      errorSub.remove();
    };
  }, []);

  const startListening = useCallback(() => {
    if (!VoiceRecognition || !isAvailable) return;
    setIsPending(true);
    ensureMicPermission()
      .then((granted) => {
        if (!granted) {
          console.warn("[VoiceRecognition] RECORD_AUDIO permission denied");
          setIsPending(false);
          return;
        }
        VoiceRecognition.startListening(locale ?? null);
      })
      .catch((err) => {
        console.warn("[VoiceRecognition] Permission error:", err);
        setIsPending(false);
      });
  }, [isAvailable, locale]);

  const stopListening = useCallback(() => {
    if (!VoiceRecognition) return;
    setIsPending(false);
    setIsListening(false);
    VoiceRecognition.stopListening();
  }, []);

  return { isListening, isPending, isAvailable, startListening, stopListening };
}
