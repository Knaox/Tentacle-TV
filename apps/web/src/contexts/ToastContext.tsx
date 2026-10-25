import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Toast } from "../components/Toast";

type ToastType = "success" | "error" | "info";
export interface ToastAction {
  label: string;
  onPress: () => void;
}
interface ToastOptions {
  /** Ce qui n'a pas marché, au-dessus du message (qui dit alors pourquoi). */
  title?: string;
  /** Un geste à côté du message (« Ajouté à X — Changer ») : il ferme l'avis. */
  action?: ToastAction;
}
interface ToastItem { id: number; type: ToastType; message: string; title?: string; action?: ToastAction }
interface ToastContextValue { show: (type: ToastType, message: string, options?: ToastOptions) => void }

/** Au-delà, les plus anciens cèdent la place : l'écran reste lisible. */
const MAX_VISIBLE = 4;

const Ctx = createContext<ToastContextValue>({ show: () => {} });

export function useToast() { return useContext(Ctx); }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const show = useCallback((type: ToastType, message: string, options?: ToastOptions) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, message, title: options?.title, action: options?.action }].slice(-MAX_VISIBLE));
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {/* Une région vivante unique : un lecteur d'écran dit chaque message sans
          prendre le focus. Chaque toast compte son temps lui-même (pause au
          survol et au focus). */}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <Toast key={t.id} id={t.id} type={t.type} title={t.title} message={t.message} action={t.action} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
