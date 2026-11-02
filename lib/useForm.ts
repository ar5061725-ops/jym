"use client";

import { useRef, useState } from "react";
import { friendlyError, haptic } from "./utils";

type Problem = { field: string; message: string } | null;
type AlertState = { msg: string; kind: "error" | "ok" } | null;

type Options<K extends string> = {
  validate?: (v: Record<K, string>) => Problem;
  submit: (v: Record<K, string>, ctx: { alert: (msg: string, kind?: "error" | "ok") => void; reset: () => void }) => Promise<void>;
};

/** Collects field values, validates, handles loading + errors */
export function useForm<K extends string>(initial: Record<K, string>, { validate, submit }: Options<K>) {
  const [values, setValues] = useState(initial);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = (k: K) => (v: string) => {
    setValues(s => ({ ...s, [k]: v }));
    if (invalid === k) setInvalid(null);
  };
  const reset = () => setValues(initial);
  const focus = (k: string) => formRef.current?.querySelector<HTMLInputElement>(`[name=${k}]`)?.focus();
  const trimmed = () => Object.fromEntries(Object.entries<string>(values).map(([k, v]) => [k, v.trim()])) as Record<K, string>;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    const v = trimmed();
    const problem = validate?.(v);
    if (problem) {
      setInvalid(problem.field);
      focus(problem.field);
      setAlert({ msg: problem.message, kind: "error" });
      haptic([20, 40, 20]);
      return;
    }
    setLoading(true);
    try {
      await submit(v, { alert: (msg, kind = "error") => setAlert({ msg, kind }), reset });
    } catch (err) {
      setAlert({ msg: friendlyError(err), kind: "error" });
      haptic([20, 40, 20]);
    } finally {
      setLoading(false);
    }
  };

  return { values, set, invalid, alert, loading, onSubmit, formRef, focus };
}
