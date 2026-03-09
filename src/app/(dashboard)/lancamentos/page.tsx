"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { Plus, Search, Filter, Trash2, Edit2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";

export default function LancamentosPage() {
    const { user } = useAuth();
    const { activeMonth } = useAppStore();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState("");
    const [tipoFilter, setTipoFilter] = useState("todos");
    const [statusFilter, setStatusFilter] = useState("todos");
    const [categoriaFilter, setCategoriaFilter] = useState("todos");
    const [subcategoriaFilter, setSubcategoriaFilter] = useState("todos");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<any>(null);

    function formatCurrency(value: number) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    useEffect(() => {
        if (user && activeMonth) {
            fetchTransactions();
        }
    }, [user, activeMonth]);

    const fetchTransactions = async () => {
        setLoading(true);
        // We load from supabase directly including joined tables
        const { data, error } = await supabase
            .from('lancamentos')
            .select(`
                *,
                categorias ( nome, icone, cor ),
                subcategorias ( nome ),
                carteiras ( nome ),
                fontes_renda ( nome )
            `)
            .eq('user_id', user!.id)
            .eq('mes', activeMonth)
            .order('data', { ascending: false });

        if (data) setTransactions(data);
        setLoading(false);
    };

    const handleDelete = async (t: any) => {
        if (!confirm("Tem certeza que deseja excluir? Se for uma compra parcelada, TODAS as parcelas vinculadas serão excluídas!")) return;

        // Se for renda, precisamos reverter também as contribuições
        if (t.tipo === 'renda') {
            const { data: contrib } = await supabase.from('contribuicoes').select('*').eq('lancamento_id', t.id).single();
            if (contrib) {
                const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user!.id).single();
                if (f) {
                    await supabase.from('fundos').update({
                        fixo_saldo: Math.max(0, f.fixo_saldo - contrib.fixo_valor),
                        emergencia_saldo: Math.max(0, f.emergencia_saldo - contrib.emergencia_valor),
                        outro_saldo: Math.max(0, f.outro_saldo - contrib.outro_valor)
                    }).eq('id', f.id);
                }
            }
        }

        if (t.group_id) {
            await supabase.from('lancamentos').delete().eq('group_id', t.group_id);
        } else if (t.parcela_total > 1) {
            // Delete legacy installments (without group_id) that share the same description, total installments and value
            await supabase.from('lancamentos').delete()
                .eq('descricao', t.descricao)
                .eq('parcela_total', t.parcela_total)
                .eq('valor', t.valor);
        } else {
            await supabase.from('lancamentos').delete().eq('id', t.id);
        }

        fetchTransactions();
    };

    const handleToggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'pago' ? 'pendente' : 'pago';
        await supabase.from('lancamentos').update({ status: newStatus }).eq('id', id);
        fetchTransactions();
    };

    const filteredTransactions = transactions.filter(t => {
        const matchSearch = t.descricao.toLowerCase().includes(search.toLowerCase());
        const matchTipo = tipoFilter === 'todos' || t.tipo === tipoFilter;
        const matchStatus = statusFilter === 'todos' || t.status === statusFilter;
        const matchCat = categoriaFilter === 'todos' || t.categorias?.nome === categoriaFilter;
        const matchSub = subcategoriaFilter === 'todos' || t.subcategorias?.nome === subcategoriaFilter;
        return matchSearch && matchTipo && matchStatus && matchCat && matchSub;
    });

    const availableCategorias = Array.from(new Set(transactions.filter(t => t.tipo === 'despesa' && t.categorias).map(t => t.categorias.nome)));
    const availableSubcategorias = Array.from(new Set(transactions.filter(t => t.tipo === 'despesa' && t.subcategorias && (categoriaFilter === 'todos' || t.categorias?.nome === categoriaFilter)).map(t => t.subcategorias.nome)));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-borders">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight">
                        Lançamentos
                    </h1>
                    <p className="text-foreground/60 mt-1">
                        Gerencie suas receitas e despesas de <span className="text-brand-green font-medium">{activeMonth}</span>
                    </p>
                </div>
                <button
                    onClick={() => {
                        setTransactionToEdit(null);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-brand-green text-[#0f131a] px-5 py-2.5 rounded-xl font-bold hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20"
                >
                    <Plus className="w-5 h-5" /> Novo Lançamento <span className="hidden md:inline text-[#0f131a]/60 text-xs ml-2 border border-[#0f131a]/30 rounded px-1.5 py-0.5">N</span>
                </button>
            </header>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 p-4 bg-surface rounded-2xl border border-borders">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 w-5 h-5 text-foreground/40" />
                    <input
                        placeholder="Buscar por descrição..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-background border border-borders rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-brand-green transition-all"
                    />
                </div>
                <div className="flex flex-wrap gap-4">
                    <select
                        value={tipoFilter}
                        onChange={(e) => setTipoFilter(e.target.value)}
                        className="bg-background border border-borders rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-green transition-all min-w-[140px]"
                    >
                        <option value="todos">Todos os tipos</option>
                        <option value="renda">Rendas</option>
                        <option value="despesa">Despesas</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-background border border-borders rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-green transition-all min-w-[140px]"
                    >
                        <option value="todos">Todos status</option>
                        <option value="pago">Pagos/Recebidos</option>
                        <option value="pendente">Pendentes</option>
                    </select>
                    {tipoFilter !== 'renda' && availableCategorias.length > 0 && (
                        <select
                            value={categoriaFilter}
                            onChange={(e) => {
                                setCategoriaFilter(e.target.value);
                                setSubcategoriaFilter('todos');
                            }}
                            className="bg-background border border-borders rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-green transition-all min-w-[140px]"
                        >
                            <option value="todos">Todas Categorias</option>
                            {availableCategorias.map((c: any) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}
                    {tipoFilter !== 'renda' && availableSubcategorias.length > 0 && (
                        <select
                            value={subcategoriaFilter}
                            onChange={(e) => setSubcategoriaFilter(e.target.value)}
                            className="bg-background border border-borders rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-green transition-all min-w-[140px]"
                        >
                            <option value="todos">Todas Subcategorias</option>
                            {availableSubcategorias.map((s: any) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="bg-cards border border-borders rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-foreground/50">Carregando lançamentos...</div>
                ) : filteredTransactions.length === 0 ? (
                    <div className="p-12 text-center text-foreground/50 flex flex-col items-center">
                        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4 border border-borders">
                            <Filter className="w-8 h-8 text-foreground/30" />
                        </div>
                        <p className="font-semibold text-white mb-1">Nenhum lançamento encontrado</p>
                        <p className="text-sm">Tente ajustar os filtros ou adicione um novo registro.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-borders">
                        {filteredTransactions.map(t => (
                            <div key={t.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 px-6 hover:bg-white/[0.02] transition-colors gap-4">
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${t.tipo === 'renda' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-red/10 text-brand-red'}`}>
                                        {t.tipo === 'renda' ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
                                    </div>
                                    <div className="flex-1 min-w-[180px]">
                                        <p className="font-semibold text-white truncate">{t.descricao}</p>
                                        <p className="text-sm text-foreground/60 flex items-center gap-2 mt-0.5">
                                            {t.tipo === 'despesa' && t.categorias ? (
                                                <span className="flex items-center gap-1 group relative cursor-default">
                                                    <span>{t.categorias.icone}</span> {t.categorias.nome}
                                                    {t.subcategorias && (
                                                        <span className="text-foreground/40 ml-1 text-xs px-1.5 py-0.5 border border-borders rounded bg-background group-hover:bg-white/10 group-hover:text-white transition-colors">
                                                            {t.subcategorias.nome}
                                                        </span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1">
                                                    🌟 {t.fontes_renda?.nome || 'Renda'}
                                                </span>
                                            )}
                                            {t.parcela_atual && t.parcela_total && (
                                                <span className="text-brand-blue ml-2 font-medium text-xs border border-brand-blue/30 rounded px-1.5 py-0.5 whitespace-nowrap">
                                                    Parcela {t.parcela_atual}/{t.parcela_total}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                                    <div className="text-left sm:text-right">
                                        <p className={`font-sans font-bold text-lg ${t.tipo === 'renda' ? 'text-brand-green' : 'text-brand-red'}`}>
                                            {t.tipo === 'renda' ? '+' : '-'} {formatCurrency(t.valor)}
                                        </p>
                                        <p className="text-xs text-foreground/50">{t.carteiras?.nome}</p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleToggleStatus(t.id, t.status)}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${t.status === 'pago' ? 'bg-brand-green/10 text-brand-green border-brand-green/20' : 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/20'}`}
                                        >
                                            {t.status.toUpperCase()}
                                        </button>

                                        <button
                                            onClick={() => {
                                                setTransactionToEdit(t);
                                                setIsModalOpen(true);
                                            }}
                                            className="p-2 text-foreground/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => handleDelete(t)}
                                            className="p-2 text-foreground/40 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setTransactionToEdit(null);
                }}
                onSuccess={() => fetchTransactions()}
                transactionToEdit={transactionToEdit}
            />
        </div>
    );
}
