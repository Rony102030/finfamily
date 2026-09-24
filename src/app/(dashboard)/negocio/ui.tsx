"use client";

import { ReactNode } from "react";

export const inputCls = "w-full bg-surface border border-borders rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow transition-all placeholder:text-foreground/30";
export const labelCls = "block text-xs font-medium text-foreground/70 mb-1";
export const btnPrimario = "font-bold py-3 px-5 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 bg-brand-yellow hover:bg-brand-yellow/90 text-background";
export const btnSecundario = "text-sm font-medium py-2 px-3 rounded-lg border border-borders text-foreground/80 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40";

export function Card({ titulo, extra, children, className = "" }: { titulo?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={`bg-cards border border-borders rounded-2xl p-5 ${className}`}>
            {(titulo || extra) && (
                <div className="flex items-center justify-between gap-3 mb-4">
                    {titulo && <h3 className="font-heading font-bold text-white text-lg">{titulo}</h3>}
                    {extra}
                </div>
            )}
            {children}
        </section>
    );
}

export function Numero({ label, valor, sub, cor = "text-white", destaque = false }: { label: string; valor: ReactNode; sub?: ReactNode; cor?: string; destaque?: boolean }) {
    return (
        <div className={`border border-borders rounded-2xl p-5 bg-cards ${destaque ? "md:col-span-2 lg:col-span-1" : ""}`}>
            <p className="text-xs uppercase font-bold tracking-wider text-foreground/50">{label}</p>
            <p className={`mt-2 font-bold tracking-tight ${destaque ? "text-3xl" : "text-2xl"} ${cor}`}>{valor}</p>
            {sub && <p className="mt-1 text-xs text-foreground/60">{sub}</p>}
        </div>
    );
}

export function CampoNumero({ label, value, onChange, prefixo, step = "1", min = "0", placeholder = "0", grande = false, dica }: {
    label: string; value: string; onChange: (v: string) => void; prefixo?: string; step?: string; min?: string; placeholder?: string; grande?: boolean; dica?: ReactNode;
}) {
    return (
        <div>
            <label className={labelCls}>{label}</label>
            <div className="relative flex items-center">
                {prefixo && <span className="absolute left-3 text-foreground/50 text-sm font-medium">{prefixo}</span>}
                <input
                    type="number" inputMode="decimal" step={step} min={min} value={value} placeholder={placeholder}
                    onChange={e => onChange(e.target.value)}
                    className={`${inputCls} ${prefixo ? "pl-10" : ""} ${grande ? "text-lg font-bold" : ""}`}
                />
            </div>
            {dica && <p className="text-[11px] text-foreground/50 mt-1">{dica}</p>}
        </div>
    );
}

export const n = (s: string) => {
    const v = parseFloat(String(s).replace(',', '.'));
    return Number.isFinite(v) ? v : 0;
};
export const inteiro = (s: string) => Math.max(0, Math.floor(n(s)));

export function Vazio({ children }: { children: ReactNode }) {
    return <div className="text-center py-10 text-sm text-foreground/50 border border-dashed border-borders rounded-2xl">{children}</div>;
}
