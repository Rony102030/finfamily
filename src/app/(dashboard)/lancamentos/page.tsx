"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { Plus, Search, Filter, Trash2, Edit2, ArrowDownCircle, ArrowUpCircle, Calendar } from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";
import { DateRangePicker } from "@/components/DateRangePicker";
import { MultiSelect } from "@/components/MultiSelect";

export default function LancamentosPage() {
    const { user } = useAuth();
    const { activeMonth } = useAppStore();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState("");
    const [tipoFilter, setTipoFilter] = useState("todos");
    const [statusFilter, setStatusFilter] = useState("todos");
    const [categoriaFilter, setCategoriaFilter] = useState<string[]>([]);
    const [subcategoriaFilter, setSubcategoriaFilter] = useState<string[]>([]);
    const [carteiraFilter, setCarteiraFilter] = useState<string[]>([]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<any>(null);

    function formatCurrency(value: number) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    function formatDate(dateString: string) {
        if (!dateString) return "";
        const [year, month, day] = dateString.substring(0, 10).split('-');
        return `${day}/${month}/${year}`;
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

        if (t.tipo === 'renda') {
            // Renda deletions now only affect the overall dashboard Renda Bruta. 
            // Fundos are manually distributed per month and are no longer tied to individual lancamentos.
        }

        let refundAmount = 0;
        if (t.tipo === 'despesa' && t.categorias?.nome === 'Emergência') {
            if (t.group_id) {
                const { data: items } = await supabase.from('lancamentos').select('valor').eq('group_id', t.group_id);
                if (items) {
                    refundAmount = items.reduce((acc: number, curr: any) => acc + curr.valor, 0);
                }
            } else if (t.parcela_total > 1) {
                const { data: items } = await supabase.from('lancamentos').select('valor')
                    .eq('descricao', t.descricao)
                    .eq('parcela_total', t.parcela_total)
                    .eq('valor', t.valor);
                if (items) {
                    refundAmount = items.reduce((acc: number, curr: any) => acc + curr.valor, 0);
                }
            } else {
                refundAmount = t.valor;
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

        if (refundAmount > 0) {
            const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user!.id).single();
            if (f) {
                await supabase.from('fundos').update({
                    emergencia_saldo: Math.max(0, parseFloat(f.emergencia_saldo || "0") + refundAmount)
                }).eq('id', f.id);
            }
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
        const matchStatus = statusFilter === 'todos' || 
                            (statusFilter === 'parceladas' && t.parcela_total > 1) || 
                            t.status === statusFilter;
        const matchCat = categoriaFilter.length === 0 || categoriaFilter.includes(t.categorias?.nome);
        const matchSub = subcategoriaFilter.length === 0 || subcategoriaFilter.includes(t.subcategorias?.nome);
        const matchCarteira = carteiraFilter.length === 0 || carteiraFilter.includes(t.carteiras?.nome);
        
        const tDate = t.data;
        const matchData = (!startDate || (tDate && tDate >= startDate)) && (!endDate || (tDate && tDate <= endDate));
        return matchSearch && matchTipo && matchStatus && matchCat && matchSub && matchCarteira && matchData;
    });

    const availableCategorias = Array.from(new Set(transactions.filter(t => t.tipo === 'despesa' && t.categorias).map(t => t.categorias.nome)));
    const availableSubcategorias = Array.from(new Set(transactions.filter(t => t.tipo === 'despesa' && t.subcategorias && (categoriaFilter.length === 0 || categoriaFilter.includes(t.categorias?.nome))).map(t => t.subcategorias.nome)));
    const availableCarteiras = Array.from(new Set(transactions.map(t => t.carteiras?.nome).filter(Boolean)));

    const filterRendas = filteredTransactions.filter(t => t.tipo === 'renda').reduce((acc, curr) => acc + curr.valor, 0);
    const filterDespesas = filteredTransactions.filter(t => t.tipo === 'despesa').reduce((acc, curr) => acc + curr.valor, 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-borders">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight">
                        Lançamentos
                    </h1>
                    <p className="text-foreground/60 mt-1">
                        Gerencie suas receitas e despesas de <span className="text-brand-green font-medium">{activeMonth}</span>
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto mt-4 lg:mt-0">
                    <div className="flex-1 flex bg-surface border border-borders rounded-xl overflow-hidden divide-x divide-borders">
                        <div className="flex-1 px-4 py-2 flex flex-col justify-center text-center sm:text-left min-w-[120px]">
                            <span className="text-[10px] uppercase font-bold text-brand-green/80">Receitas</span>
                            <span className="text-brand-green font-bold text-sm">{formatCurrency(filterRendas)}</span>
                        </div>
                        <div className="flex-1 px-4 py-2 flex flex-col justify-center text-center sm:text-left min-w-[120px]">
                            <span className="text-[10px] uppercase font-bold text-brand-red/80">Despesas</span>
                            <span className="text-brand-red font-bold text-sm">{formatCurrency(filterDespesas)}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setTransactionToEdit(null);
                            setIsModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-2 bg-brand-green text-[#0f131a] px-5 py-2.5 rounded-xl font-bold hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20 w-full sm:w-auto"
                    >
                        <Plus className="w-5 h-5" /> Novo Lançamento <span className="hidden md:inline text-[#0f131a]/60 text-xs ml-2 border border-[#0f131a]/30 rounded px-1.5 py-0.5">N</span>
                    </button>
                </div>
            </header>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 p-4 bg-surface rounded-2xl border border-borders">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-2.5 w-5 h-5 text-foreground/40" />
                    <input
                        placeholder="Buscar por descrição..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-background border border-borders rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-brand-green transition-all"
                    />
                </div>
                <div className="flex flex-wrap gap-4 w-full">
                    <div className="flex-1 min-w-[200px] md:flex-none">
                        <DateRangePicker 
                            startDate={startDate}
                            endDate={endDate}
                            onChange={(start: string, end: string) => {
                                setStartDate(start);
                                setEndDate(end);
                            }}
                        />
                    </div>
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
                        <option value="parceladas">Apenas Parceladas</option>
                    </select>
                    {availableCarteiras.length > 0 && (
                        <MultiSelect
                            placeholder="Carteiras / Bancos"
                            options={availableCarteiras as string[]}
                            selected={carteiraFilter}
                            onChange={setCarteiraFilter}
                        />
                    )}
                    {tipoFilter !== 'renda' && availableCategorias.length > 0 && (
                        <MultiSelect
                            placeholder="Categorias"
                            options={availableCategorias as string[]}
                            selected={categoriaFilter}
                            onChange={(selected) => {
                                setCategoriaFilter(selected);
                                setSubcategoriaFilter([]);
                            }}
                        />
                    )}
                    {tipoFilter !== 'renda' && availableSubcategorias.length > 0 && (
                        <MultiSelect
                            placeholder="Subcategorias"
                            options={availableSubcategorias as string[]}
                            selected={subcategoriaFilter}
                            onChange={setSubcategoriaFilter}
                        />
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
                                        <div className="flex items-center gap-2.5 mb-0.5">
                                            <p className="font-semibold text-white truncate">{t.descricao}</p>
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/[0.03] text-foreground/50 border border-white/10 flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-foreground/40" />
                                                {formatDate(t.data)}
                                            </span>
                                        </div>
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
