"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { formatMonth, formatCurrency } from "@/lib/format";
import { Repeat, CheckCircle2, PlayCircle, Trash2 } from "lucide-react";

export default function RecorrentesPage() {
    const { user } = useAuth();
    const { activeMonth } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [recorrentes, setRecorrentes] = useState<any[]>([]);
    const [jaLancados, setJaLancados] = useState<Set<string>>(new Set());
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        if (user && activeMonth) {
            fetchData();
        }
    }, [user, activeMonth]);

    const fetchData = async () => {
        setLoading(true);
        // 1. Fetch all distinct recurring transactions (by looking at all lancamentos with recorrente = true)
        // Since we don't have a separate table or complex distinct query in standard supabase without RPC,
        // we fetch all recurring and deduplicate by 'descricao' in JS.
        const { data: allRec } = await supabase
            .from('lancamentos')
            .select('*, categorias(nome, icone), carteiras(nome)')
            .eq('user_id', user!.id)
            .eq('recorrente', true)
            .eq('tipo', 'despesa')
            .order('data', { ascending: false });

        // 2. Fetch current month's transactions to see if they are already launched
        const { data: currentMonthTxs } = await supabase
            .from('lancamentos')
            .select('descricao')
            .eq('user_id', user!.id)
            .eq('mes', activeMonth);

        const currentMonthSet = new Set((currentMonthTxs || []).map(t => t.descricao.toLowerCase().trim()));
        setJaLancados(currentMonthSet);

        // Deduplicate
        const unique = [];
        const seen = new Set();
        if (allRec) {
            for (const t of allRec) {
                const key = t.descricao.toLowerCase().trim();
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(t);
                }
            }
        }

        setRecorrentes(unique);
        setLoading(false);
    };

    const handleLancar = async (tx: any) => {
        setSavingId(tx.id);
        const { error } = await supabase.from('lancamentos').insert({
            user_id: user!.id,
            mes: activeMonth,
            tipo: tx.tipo,
            descricao: tx.descricao,
            valor: tx.valor,
            data: `${activeMonth}-${new Date().getDate().toString().padStart(2, '0')}`, // Today's date but forced to activeMonth
            carteira_id: tx.carteira_id,
            status: 'pendente',
            recorrente: true,
            categoria_id: tx.categoria_id,
            subcategoria_id: tx.subcategoria_id
        });

        if (!error) {
            setJaLancados(new Set(jaLancados).add(tx.descricao.toLowerCase().trim()));
        }
        setSavingId(null);
    };

    const handleDelete = async (descricao: string) => {
        if (!confirm(`Deseja cancelar a conta recorrente "${descricao}"? Ela não aparecerá mais aqui nos próximos meses.\n(Os pagamentos anteriores no painel de Lançamentos não serão perdidos).`)) return;

        const { error } = await supabase
            .from('lancamentos')
            .update({ recorrente: false })
            .eq('user_id', user!.id)
            .eq('descricao', descricao);

        if (!error) {
            setRecorrentes(recorrentes.filter(r => r.descricao.toLowerCase().trim() !== descricao.toLowerCase().trim()));
        } else {
            alert('Erro ao cancelar recorrência. Tente novamente.');
        }
    };

    if (loading) return <div className="p-8 text-foreground/50 animate-pulse">Buscando contas recorrentes...</div>;

    const pendentes = recorrentes.filter(r => !jaLancados.has(r.descricao.toLowerCase().trim()));
    const concluidos = recorrentes.filter(r => jaLancados.has(r.descricao.toLowerCase().trim()));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="pb-6 border-b border-borders">
                <h1 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
                    <Repeat className="text-brand-blue w-6 h-6" /> Contas Recorrentes
                </h1>
                <p className="text-foreground/60 mt-1">
                    Gerencie suas despesas fixas (como Aluguel, Internet) e lance-as rapidamente em <span className="text-brand-green font-medium">{formatMonth(activeMonth)}</span>.
                </p>
            </header>

            <div className="bg-cards border border-borders rounded-2xl p-6">
                <h3 className="font-heading font-bold text-white mb-6 text-lg">Pendentes para este mês</h3>

                {pendentes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendentes.map(tx => (
                            <div key={tx.id} className="bg-surface border border-brand-blue/30 rounded-xl p-5 hover:border-brand-blue transition-colors relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-blue/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center text-xl border border-brand-blue/20">
                                            {tx.categorias?.icone || '💰'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white leading-tight">{tx.descricao}</p>
                                            <p className="text-xs text-foreground/50">{tx.categorias?.nome}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(tx.descricao)}
                                        className="p-2 text-foreground/50 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors"
                                        title="Cancelar Recorrência"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="font-sans font-bold text-2xl text-brand-red mb-1">{formatCurrency(tx.valor)}</p>
                                <p className="text-xs text-foreground/50 mb-4">{tx.carteiras?.nome || 'Nenhuma carteira'}</p>

                                <button
                                    onClick={() => handleLancar(tx)}
                                    disabled={savingId === tx.id}
                                    className="w-full bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue border border-brand-blue/30 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {savingId === tx.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <><PlayCircle className="w-4 h-4" /> Lançar como Pendente</>}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-foreground/50 border border-dashed border-borders rounded-xl flex flex-col items-center">
                        <CheckCircle2 className="w-10 h-10 text-brand-green/50 mb-3" />
                        <p>Tudo em dia!</p>
                        <p className="text-sm">Não há contas recorrentes pendentes para {formatMonth(activeMonth)}.</p>
                    </div>
                )}
            </div>

            <div className="opacity-60">
                <h3 className="font-heading font-bold text-white mb-4 text-sm uppercase tracking-wider pl-2">Já lançados neste mês ({concluidos.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {concluidos.map(tx => (
                        <div key={tx.id} className="bg-surface border border-borders rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white text-sm">{tx.descricao}</p>
                                    <p className="font-bold text-brand-red text-xs">{formatCurrency(tx.valor)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
