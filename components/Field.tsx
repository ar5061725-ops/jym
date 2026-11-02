"use client";

import { useId } from "react";

type Props = {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
  inputMode?: "decimal" | "numeric";
  list?: string;
};

export function Field({ name, label, value, onChange, invalid, type = "text", ...rest }: Props) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        className={`input${invalid ? " invalid" : ""}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        dir={type === "email" ? "ltr" : undefined}
        {...rest}
      />
    </div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} />;
}
