import type { ReactNode } from "react";
import "./formula-notation.css";

export function Symbol({ children, sub, sup }: { children: ReactNode; sub?: ReactNode; sup?: ReactNode }) {
  return <span className="formula-symbol"><i>{children}</i>{sub !== undefined ? <sub>{sub}</sub> : null}{sup !== undefined ? <sup>{sup}</sup> : null}</span>;
}

export function Fraction({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return <span className="formula-fraction"><span>{top}</span><span>{bottom}</span></span>;
}

export function Root({ children }: { children: ReactNode }) {
  return <span className="formula-root"><b>√</b><span>{children}</span></span>;
}

export function Power({ children, exponent }: { children: ReactNode; exponent: ReactNode }) {
  return <span className="formula-power"><span>{children}</span><sup>{exponent}</sup></span>;
}

export function Abs({ children }: { children: ReactNode }) {
  return <span className="formula-abs">{children}</span>;
}

export function Fn({ children }: { children: ReactNode }) {
  return <span className="formula-function">{children}</span>;
}
