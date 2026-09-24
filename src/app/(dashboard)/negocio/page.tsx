"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { formatMonth } from "@/lib/format";
import { Drumstick } from "lucide-react";
import { NegocioBloqueado } from "@/components/NegocioBloqueado";
import { useFrangoData } from "./data";
import { ResumoTab } from "./tabs/ResumoTab";
import { FechamentoTab } from "./tabs/FechamentoTab";
import { ComprasTab } from "./tabs/ComprasTab";
import { FiadosTab } from "./tabs/FiadosTab";
import { EstoqueTab } from "./tabs/EstoqueTab";
import { AjustesTab } from "./tabs/AjustesTab";

export type Aba = 'resumo' | 'fechamento' | 'compras' | 'fiados' | 'estoque' | 'ajustes';

const abas: { id: Aba; label: string }[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'fechamento', label: 'Fechar dia' },
    { id: 'compras', label: 'Compras' },
    { id: 'fiados', label: 'Fiados' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'ajustes', label: 'Ajustes' },
];

export default function NegocioPage() {
    const { user } = useAuth();
    const { activeMonth } = useAppStore();
    const { data, erro, carregando, recarregar } = useFrangoData(user?.id);
    const [aba, setAba] = useState<Aba>('resumo');

    if (!carregando && erro === 'SEM_ACESSO') return <NegocioBloqueado />;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <header className="pb-4 border-b border-borders">
                <div className="flex items-center gap-3">
                    <Drumstick className="w-8 h-8 text-brand-yellow" />
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight">{data?.config.nome || "Meu Negócio"}</h1>
                </div>
                <p className="text-foreground/60 mt-1">
                    Controle do negócio, separado das finanças da casa — <span className="text-brand-yellow font-medium">{formatMonth(activeMonth)}</span>
                </p>
            </header>

            <div className="flex gap-2 p-1 bg-surface border border-borders rounded-xl overflow-x-auto custom-scrollbar">
                {abas.map(a => (
                    <button
                        key={a.id}
                        onClick={() => setAba(a.id)}
                        className={`flex-1 min-w-[96px] py-2.5 px-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${aba === a.id
                            ? "bg-brand-yellow text-background shadow-md shadow-brand-yellow/20"
                            : "text-foreground/70 hover:text-white hover:bg-white/5"}`}
                    >
                        {a.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[400px]">
                {carregando && <div className="p-8 text-foreground/50 animate-pulse text-center">Carregando...</div>}

                {!carregando && erro === 'SEM_TABELAS' && (
                    <div className="bg-cards border border-brand-yellow/40 rounded-2xl p-4 sm:p-6 text-sm text-foreground/80 space-y-2">
                        <p className="font-bold text-white">Falta criar as tabelas do negócio no banco.</p>
                        <p>Rode o arquivo <code className="text-brand-yellow">migration_hora_do_frango.sql</code> no Supabase (SQL Editor) e recarregue esta página.</p>
                    </div>
                )}
                {!carregando && erro && erro !== 'SEM_TABELAS' && (
                    <div className="bg-cards border border-brand-red/40 rounded-2xl p-4 sm:p-6 text-sm text-brand-red">Erro ao carregar: {erro}</div>
                )}

                {!carregando && data && user && (
                    <>
                        {aba === 'resumo' && <ResumoTab d={data} mes={activeMonth} irPara={setAba} />}
                        {aba === 'fechamento' && <FechamentoTab d={data} mes={activeMonth} userId={user.id} recarregar={recarregar} />}
                        {aba === 'compras' && <ComprasTab d={data} mes={activeMonth} userId={user.id} recarregar={recarregar} />}
                        {aba === 'fiados' && <FiadosTab d={data} userId={user.id} recarregar={recarregar} />}
                        {aba === 'estoque' && <EstoqueTab d={data} irPara={setAba} />}
                        {aba === 'ajustes' && <AjustesTab d={data} userId={user.id} recarregar={recarregar} />}
                    </>
                )}
            </div>
        </div>
    );
}
