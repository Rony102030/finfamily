"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { formatMonth, formatCurrency } from "@/lib/format";
import {
    Building2, RefreshCcw, CheckCircle2, XCircle, ArrowUpCircle, ArrowDownCircle,
    Zap, Search, Filter, Tag
} from "lucide-react";

interface TransacaoPluggy {
    id: string;
    pluggy_id: string | null;
    tipo: 'CREDIT' | 'DEBIT';
    descricao: string;
    valor: number;
    data: string;
    mes: string;
    status_pluggy: string;
    metodo_pagamento: string | null;
    pagador_nome: string | null;
    recebedor_nome: string | null;
    classificado: boolean;
    lancamento_id: string | null;
}

export default function TransacoesBancoPage() {
    const { user } = useAuth();
    const { activeMonth } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [transacoes, setTransacoes] = useState<TransacaoPluggy[]>([]);
    const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'classificadas'>('todas');
    const [busca, setBusca] = useState("");
    const [lastSync, setLastSync] = useState<string | null>(null);

    useEffect(() => {
        if (user && activeMonth) fetchData();
    }, [user, activeMonth]);

    const fetchData = async () => {
        setLoading(true);

        const { data } = await supabase
            .from('transacoes_pluggy')
            .select('*')
            .eq('user_id', user!.id)
            .eq('mes', activeMonth)
            .order('data', { ascending: false });

        if (data) setTransacoes(data);

        const { data: config } = await supabase
            .from('pluggy_config')
            .select('last_sync')
            .eq('user_id', user!.id)
            .single();

        if (config?.last_sync) setLastSync(config.last_sync);
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/pluggy/sync', { method: 'POST' });
            const result = await res.json();

            if (result.mock) {
                const mockRes = await fetch(`/api/pluggy/transactions?mes=${activeMonth}`);
                const mockData = await mockRes.json();

                if (mockData.data && user) {
                    const toInsert = mockData.data.map((t: any) => ({
                        user_id: user.id,
                        pluggy_id: t.id,
                        tipo: t.tipo,
                        descricao: t.descricao,
                        valor: t.valor,
                        data: t.data,
                        mes: activeMonth,
                        status_pluggy: t.status_pluggy,
                        metodo_pagamento: t.metodo_pagamento || null,
                        pagador_nome: t.pagador_nome || null,
                        recebedor_nome: t.recebedor_nome || null,
                        classificado: false,
                    }));

                    const { data: inserted } = await supabase
                        .from('transacoes_pluggy')
                        .upsert(toInsert, { onConflict: 'user_id,pluggy_id' })
                        .select();

                    if (inserted) setTransacoes(inserted);

                    await supabase
                        .from('pluggy_config')
                        .upsert({ user_id: user.id, last_sync: new Date().toISOString(), sync_status: 'ok' }, { onConflict: 'user_id' });

                    setLastSync(new Date().toISOString());
                }
            }
        } catch {
            alert('Erro ao sincronizar. Tente novamente.');
        }
        setSyncing(false);
    };

    const handleClassificar = async (tx: TransacaoPluggy) => {
        try {
            const res = await fetch('/api/classificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descricao: tx.descricao }),
            });
            const result = await res.json();

            if (result.classificado) {
                await supabase
                    .from('transacoes_pluggy')
                    .update({ classificado: true })
                    .eq('id', tx.id)
                    .eq('user_id', user!.id);

                setTransacoes(transacoes.map(t =>
                    t.id === tx.id ? { ...t, classificado: true } : t
                ));

                alert(`Classificado como: ${result.tipo_transacao}${result.categoria_nome ? ` → ${result.categoria_nome}` : ''}${result.subcategoria_nome ? ` → ${result.subcategoria_nome}` : ''}`);
            } else {
                alert('Não foi possível classificar automaticamente. Crie uma regra manual ou classifique manualmente.');
            }
        } catch {
            alert('Erro ao classificar.');
        }
    };

    const filteredTxs = transacoes
        .filter(t => {
            if (filtro === 'pendentes') return !t.classificado;
            if (filtro === 'classificadas') return t.classificado;
            return true;
        })
        .filter(t => !busca || t.descricao.toLowerCase().includes(busca.toLowerCase()));

    const totalCreditos = filteredTxs.filter(t => t.tipo === 'CREDIT').reduce((a, t) => a + t.valor, 0);
    const totalDebitos = filteredTxs.filter(t => t.tipo === 'DEBIT').reduce((a, t) => a + t.valor, 0);
    const pendentes = transacoes.filter(t => !t.classificado).length;

    if (loading) return <div className="p-8 text-foreground/50 animate-pulse">Carregando transações bancárias...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="pb-6 border-b border-borders flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
                        <Building2 className="text-brand-blue w-6 h-6" /> Transações Bancárias
                    </h1>
                    <p className="text-foreground/60 mt-1">
                        Importação via Pluggy — {formatMonth(activeMonth)}
                        {lastSync && <span className="text-xs ml-2 text-foreground/40">(última sync: {new Date(lastSync).toLocaleString('pt-BR')})</span>}
                    </p>
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-brand-blue hover:bg-brand-blue/90 text-background font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                >
                    <RefreshCcw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Sincronizando...' : 'Sincronizar'}
                </button>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-brand-green/5 border border-brand-green/20 rounded-2xl p-5">
                    <p className="text-sm text-foreground/60 mb-1">Créditos</p>
                    <p className="text-2xl font-bold text-brand-green">{formatCurrency(totalCreditos)}</p>
                </div>
                <div className="bg-brand-red/5 border border-brand-red/20 rounded-2xl p-5">
                    <p className="text-sm text-foreground/60 mb-1">Débitos</p>
                    <p className="text-2xl font-bold text-brand-red">{formatCurrency(totalDebitos)}</p>
                </div>
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5">
                    <p className="text-sm text-foreground/60 mb-1">Pendentes</p>
                    <p className="text-2xl font-bold text-yellow-400">{pendentes}</p>
                    <p className="text-xs text-foreground/40 mt-1">transações não classificadas</p>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                    <input
                        type="text"
                        placeholder="Buscar transação..."
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        className="w-full bg-cards border border-borders rounded-xl pl-10 pr-4 py-2.5 text-white outline-none focus:border-brand-blue transition-all text-sm"
                    />
                </div>
                <div className="flex bg-cards border border-borders rounded-xl p-1 gap-1">
                    {(['todas', 'pendentes', 'classificadas'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFiltro(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtro === f ? 'bg-brand-blue/10 text-brand-blue' : 'text-foreground/50 hover:text-white'}`}
                        >
                            {f === 'todas' ? 'Todas' : f === 'pendentes' ? 'Pendentes' : 'Classificadas'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Lista */}
            {filteredTxs.length === 0 ? (
                <div className="text-center py-12 bg-cards rounded-2xl border border-dashed border-borders">
                    <Building2 className="w-10 h-10 text-foreground/30 mx-auto mb-3" />
                    <p className="text-foreground/50 font-medium">Nenhuma transação encontrada</p>
                    <p className="text-sm text-foreground/40 mt-1">Clique em "Sincronizar" para importar do banco.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredTxs.map(tx => (
                        <div key={tx.id} className="bg-cards border border-borders rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${tx.tipo === 'CREDIT' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-red/10 text-brand-red'}`}>
                                    {tx.tipo === 'CREDIT' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white font-medium text-sm truncate max-w-xs">{tx.descricao}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-foreground/40">{new Date(tx.data + "T00:00:00").toLocaleDateString('pt-BR')}</span>
                                        {tx.metodo_pagamento && <span className="text-[10px] px-1.5 py-0.5 bg-surface rounded text-foreground/50">{tx.metodo_pagamento}</span>}
                                        {tx.classificado
                                            ? <span className="flex items-center gap-0.5 text-[10px] text-brand-green"><CheckCircle2 className="w-3 h-3" /> Classificado</span>
                                            : <span className="flex items-center gap-0.5 text-[10px] text-yellow-400"><XCircle className="w-3 h-3" /> Pendente</span>
                                        }
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pl-12 sm:pl-0">
                                <span className={`font-bold text-sm ${tx.tipo === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>
                                    {tx.tipo === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.valor)}
                                </span>
                                {!tx.classificado && (
                                    <button
                                        onClick={() => handleClassificar(tx)}
                                        className="bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue border border-brand-blue/30 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                                        title="Classificar automaticamente"
                                    >
                                        <Zap className="w-3 h-3" /> Auto
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
