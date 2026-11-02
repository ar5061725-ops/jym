"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { haptic } from "@/lib/utils";

type ToastOpts = { type?: "ok" | "error"; action?: string; onAction?: () => void; duration?: number };
type ToastItem = ToastOpts & { id: number; msg: string; out?: boolean };

const Ctx = createContext<(msg: string, opts?: ToastOpts) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const close = useCallback((id: number) => {
    setItems(l => l.map(t => (t.id === id ? { ...t, out: true } : t)));
    setTimeout(() => setItems(l => l.filter(t => t.id !== id)), 220);
  }, []);

  const show = useCallback(
    (msg: string, opts: ToastOpts = {}) => {
      const id = ++seq.current;
      setItems(l => [...l, { id, msg, ...opts }]);
      setTimeout(() => close(id), opts.duration ?? 2800);
    },
    [close],
  );

  return (
    <Ctx.Provider value={show}>
      {children}
      <div id="toasts">
        {items.map(t => (
          <div key={t.id} className={`toast ${t.type ?? "ok"}${t.out ? " out" : ""}`} role="status">
            <i className="dot" />
            <span>{t.msg}</span>
            {t.action && (
              <button
                className="btn-link"
                type="button"
                onClick={() => {
                  haptic();
                  t.onAction?.();
                  close(t.id);
                }}
              >
                {t.action}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
