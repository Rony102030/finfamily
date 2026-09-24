"use client";

import { ReactNode } from "react";
import {
    PiggyBank, ShieldCheck, TrendingUp, Target, Plane, House, Car, GraduationCap, Gift, Heart,
    Smartphone, Wallet, Baby, PawPrint, X,
} from "lucide-react";

export const ICONES: Record<string, any> = {
    piggy: PiggyBank, shield: ShieldCheck, trending: TrendingUp, target: Target, plane: Plane, house: House,
    car: Car, grad: GraduationCap, gift: Gift, heart: Heart, phone: Smartphone, wallet: Wallet, baby: Baby, paw: PawPrint,
};
export const Icone = ({ nome, className }: { nome: string; className?: string }) => {
    const I = ICONES[nome] || PiggyBank;
    return <I className={className} />;
};

export const inputCls = "w-full bg-surface border border-borders rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all placeholder:text-foreground/30";
export const labelCls = "block text-xs font-medium text-foreground/70 mb-1";
export const btnPrimario = "font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 bg-brand-green hover:bg-brand-green/90 text-background";
export const btnSecundario = "text-sm font-medium py-2 px-3 rounded-lg border border-borders text-foreground/80 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40";

export const n = (s: string) => {
    const v = parseFloat(String(s).replace(',', '.'));
    return Number.isFinite(v) ? v : 0;
};

export function Modal({ titulo, onClose, children, largo = false }: { titulo: ReactNode; onClose: () => void; children: ReactNode; largo?: boolean }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className={`bg-cards border border-borders rounded-2xl w-full ${largo ? "max-w-2xl" : "max-w-lg"} shadow-2xl max-h-[90vh] flex flex-col`} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-borders">
                    <h2 className="text-lg font-heading font-bold text-white">{titulo}</h2>
                    <button onClick={onClose} className="p-2 text-foreground/50 hover:text-white rounded-lg hover:bg-white/5"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar">{children}</div>
            </div>
        </div>
    );
}

export function CampoValor({ label, value, onChange, dica, autoFocus }: { label: string; value: string; onChange: (v: string) => void; dica?: ReactNode; autoFocus?: boolean }) {
    return (
        <div>
            <label className={labelCls}>{label}</label>
            <div className="relative flex items-center">
                <span className="absolute left-3 text-foreground/50 text-sm font-medium">R$</span>
                <input type="number" inputMode="decimal" step="0.01" min="0" value={value} autoFocus={autoFocus}
                    onChange={e => onChange(e.target.value)} placeholder="0,00" className={`${inputCls} pl-10 font-bold`} />
            </div>
            {dica && <p className="text-[11px] text-foreground/50 mt-1">{dica}</p>}
        </div>
    );
}
