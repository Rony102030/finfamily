"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { formatMonth } from "@/lib/format";
import { Plus, Search, SlidersHorizontal, X, Pencil, Copy, Trash2, CheckCircle2, Clock, ArrowUpCircle, Filter, ListChecks, Check, Tag as TagIcon, Wallet } from "lucide-react";
import { TransactionModal } from "@/components/TransactionModal";
import { DateRangePicker } from "@/components/DateRangePicker";
import { MultiSelect } from "@/components/MultiSelect";
import { guardadoNoMes, isEmergenciaNome } from "@/lib/caixinhas";

type Atalho = 'tudo' | 'despesa' | 'renda' | 'reserva' | 'pendente';
const ATALHOS: { id: Atalho; label: string }[] = [
    { id: 'tudo', label: 'Tudo' },
    { id: 'despesa', label: 'Despesas' },
    { id: 'renda', label: 'Receitas' },
    { id: 'reserva', label: 'Reserva' },
    { id: 'pendente', label: 'Pendentes' },
];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
function hojeLocal(delta = 0) {
    const d = new Date();
    d.setDate(d.getDate() + delta);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function nomeDoDia(data: string) {
    if (data === hojeLocal()) return "Hoje";
    if (data === hojeLocal(-1)) return "Ontem";
    const [y, m, d] = data.split("-").map(Number);
    return `${SEMANA[new Date(y, m - 1, d).getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Mesma regra do Dashboard: categoria antiga "Fundos" e gastos pagos com a reserva não são despesa do mês.
const ehReserva = (t: any) => t.tipo === 'despesa' && isEmergenciaNome(t.categorias?.nome);
const ehDespesaDoMes = (t: any) => t.tipo === 'despesa' && !ehReserva(t) && (t.categorias?.nome || "").toLowerCase() !== 'fundos';

export default function LancamentosPage() {
    const { user } = useAuth();
    const { activeMonth } = useAppStore();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [guardado, setGuardado] = useState(0);
    const [loading, setLoading] = useState(true);

    const [busca, setBusca] = useState("");
    const [atalho, setAtalho] = useState<Atalho>('tudo');
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [categoriaFilter, setCategoriaFilter] = useState<string[]>([]);
    const [subcategoriaFilter, setSubcategoriaFilter] = useState<string[]>([]);
    const [carteiraFilter, setCarteiraFilter] = useState<string[]>([]);
    const [soParceladas, setSoParceladas] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [aberto, setAberto] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<any>(null);

    // Seleção múltipla
    const [selecionando, setSelecionando] = useState(false);
    const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
    const [acaoLote, setAcaoLote] = useState<null | 'categoria' | 'carteira'>(null);
    const [opcoes, setOpcoes] = useState<{ categorias: any[]; subcategorias: any[]; carteiras: any[] } | null>(null);

    useEffect(() => {
        if (user && activeMonth) fetchTransactions();
    }, [user, activeMonth]);

    const fetchTransactions = async () => {
        setLoading(true);
        const [lanc, mov] = await Promise.all([
            supabase.from('lancamentos')
                .select('*, categorias ( nome, icone, cor ), subcategorias ( nome ), carteiras ( nome ), fontes_renda ( nome )')
                .eq('user_id', user!.id).eq('mes', activeMonth)
                .order('data', { ascending: false }).order('created_at', { ascending: false }),
            supabase.from('caixinha_movimentos').select('mes, tipo, valor').eq('user_id', user!.id).eq('mes', activeMonth),
        ]);
        setTransactions(lanc.data || []);
        setGuardado(guardadoNoMes((mov.data || []).map((m: any) => ({ ...m, valor: Number(m.valor) })), activeMonth));
        setLoading(false);
    };

    const avisar = (texto: string) => { setAviso(texto); setTimeout(() => setAviso(null), 3500); };

    const handleDelete = async (t: any) => {
        const parcelado = t.group_id || t.parcela_total > 1;
        if (!confirm(parcelado ? `Excluir "${t.descricao}" e TODAS as parcelas dessa compra?` : `Excluir "${t.descricao}"?`)) return;

        if (t.group_id) {
            await supabase.from('lancamentos').delete().eq('group_id', t.group_id).eq('user_id', user!.id);
        } else if (t.parcela_total > 1) {
            // Parcelas antigas (sem group_id): só as que foram criadas junto com esta (mesmo minuto),
            // para não apagar outra compra parcelada com o mesmo nome e valor.
            const criado = new Date(t.created_at).getTime();
            await supabase.from('lancamentos').delete()
                .eq('user_id', user!.id).eq('descricao', t.descricao).eq('parcela_total', t.parcela_total).eq('valor', t.valor)
                .gte('created_at', new Date(criado - 60000).toISOString()).lte('created_at', new Date(criado + 60000).toISOString());
        } else {
            await supabase.from('lancamentos').delete().eq('id', t.id);
        }
        setAberto(null);
        fetchTransactions();
    };

    const alternarStatus = async (t: any) => {
        const novo = t.status === 'pago' ? 'pendente' : 'pago';
        await supabase.from('lancamentos').update({ status: novo }).eq('id', t.id);
        setAberto(null);
        fetchTransactions();
    };

    const duplicar = async (t: any) => {
        const hoje = hojeLocal();
        const { error } = await supabase.from('lancamentos').insert({
            user_id: user!.id, tipo: t.tipo, descricao: t.descricao, valor: t.valor, data: hoje, mes: hoje.slice(0, 7),
            status: 'pago', recorrente: false, categoria_id: t.categoria_id, subcategoria_id: t.subcategoria_id,
            carteira_id: t.carteira_id, fonte_renda_id: t.fonte_renda_id,
        });
        if (error) return alert("Erro ao duplicar: " + error.message);
        setAberto(null);
        avisar(`"${t.descricao}" duplicado com a data de hoje (${hoje.slice(8, 10)}/${hoje.slice(5, 7)}).`);
        fetchTransactions();
    };

    // ---------------- seleção múltipla ----------------
    const sairDaSelecao = () => { setSelecionando(false); setSelecionados(new Set()); setAcaoLote(null); };
    const alternarSelecao = (id: string) => {
        const novo = new Set(selecionados);
        if (novo.has(id)) novo.delete(id); else novo.add(id);
        setSelecionados(novo);
    };
    const itensSelecionados = () => transactions.filter(t => selecionados.has(t.id));

    const carregarOpcoes = async () => {
        if (opcoes) return;
        const [c, s2, w] = await Promise.all([
            supabase.from('categorias').select('id, nome, icone').eq('user_id', user!.id).eq('ativo', true).order('nome'),
            supabase.from('subcategorias').select('id, nome, categoria_id').eq('user_id', user!.id).order('nome'),
            supabase.from('carteiras').select('id, nome').eq('user_id', user!.id).eq('ativo', true).order('nome'),
        ]);
        setOpcoes({ categorias: c.data || [], subcategorias: s2.data || [], carteiras: w.data || [] });
    };

    /** Aplica campos nos selecionados. Em compra parcelada, categoria e carteira valem para todas as parcelas. */
    const aplicarEmLote = async (campos: Record<string, any>, itens: any[], grupoInteiro: boolean) => {
        const ids = itens.map(t => t.id);
        const grupos = grupoInteiro ? Array.from(new Set(itens.map(t => t.group_id).filter(Boolean))) : [];
        const r1 = await supabase.from('lancamentos').update(campos).eq('user_id', user!.id).in('id', ids);
        const r2 = grupos.length ? await supabase.from('lancamentos').update(campos).eq('user_id', user!.id).in('group_id', grupos) : { error: null };
        const erro = r1.error || r2.error;
        if (erro) return alert("Erro: " + erro.message);
        avisar(`${ids.length} ${ids.length === 1 ? "lançamento atualizado" : "lançamentos atualizados"}.`);
        sairDaSelecao();
        fetchTransactions();
    };

    const loteStatus = (status: 'pago' | 'pendente') => aplicarEmLote({ status }, itensSelecionados(), false);

    const loteExcluir = async () => {
        const itens = itensSelecionados();
        const grupos = Array.from(new Set(itens.map(t => t.group_id).filter(Boolean)));
        const aviso = grupos.length ? `\n\n${grupos.length} ${grupos.length === 1 ? "é compra parcelada: todas as parcelas dela" : "são compras parceladas: todas as parcelas delas"} também serão excluídas.` : "";
        if (!confirm(`Excluir ${itens.length} ${itens.length === 1 ? "lançamento" : "lançamentos"}?${aviso}`)) return;
        const r1 = await supabase.from('lancamentos').delete().eq('user_id', user!.id).in('id', itens.map(t => t.id));
        const r2 = grupos.length ? await supabase.from('lancamentos').delete().eq('user_id', user!.id).in('group_id', grupos) : { error: null };
        if (r1.error || r2.error) return alert("Erro: " + (r1.error || r2.error)!.message);
        avisar(`${itens.length} ${itens.length === 1 ? "lançamento excluído" : "lançamentos excluídos"}.`);
        sairDaSelecao();
        fetchTransactions();
    };

    // ---------------- filtros ----------------
    const q = semAcento(busca.trim());
    const qNumero = Number(busca.replace(/\./g, "").replace(",", "."));
    const filtered = transactions.filter(t => {
        if (atalho === 'despesa' && !ehDespesaDoMes(t)) return false;
        if (atalho === 'renda' && t.tipo !== 'renda') return false;
        if (atalho === 'reserva' && !ehReserva(t)) return false;
        if (atalho === 'pendente' && t.status !== 'pendente') return false;
        if (soParceladas && !(t.parcela_total > 1)) return false;
        if (categoriaFilter.length && !categoriaFilter.includes(t.categorias?.nome)) return false;
        if (subcategoriaFilter.length && !subcategoriaFilter.includes(t.subcategorias?.nome)) return false;
        if (carteiraFilter.length && !carteiraFilter.includes(t.carteiras?.nome)) return false;
        if (startDate && t.data < startDate) return false;
        if (endDate && t.data > endDate) return false;
        if (q) {
            const texto = semAcento([t.descricao, t.categorias?.nome, t.subcategorias?.nome, t.carteiras?.nome, t.fontes_renda?.nome].filter(Boolean).join(" "));
            const valorBate = Number.isFinite(qNumero) && qNumero > 0 && (Math.abs(t.valor - qNumero) < 0.005 || String(t.valor).startsWith(busca.replace(",", ".")));
            if (!texto.includes(q) && !valorBate) return false;
        }
        return true;
    });

    const filtrosAtivos = [
        ...categoriaFilter.map(v => ({ rotulo: v, limpar: () => { setCategoriaFilter(categoriaFilter.filter(x => x !== v)); setSubcategoriaFilter([]); } })),
        ...subcategoriaFilter.map(v => ({ rotulo: v, limpar: () => setSubcategoriaFilter(subcategoriaFilter.filter(x => x !== v)) })),
        ...carteiraFilter.map(v => ({ rotulo: v, limpar: () => setCarteiraFilter(carteiraFilter.filter(x => x !== v)) })),
        ...(soParceladas ? [{ rotulo: "Parceladas", limpar: () => setSoParceladas(false) }] : []),
        ...(startDate || endDate ? [{ rotulo: `${startDate ? startDate.slice(8, 10) + "/" + startDate.slice(5, 7) : "…"} a ${endDate ? endDate.slice(8, 10) + "/" + endDate.slice(5, 7) : "…"}`, limpar: () => { setStartDate(""); setEndDate(""); } }] : []),
    ];
    const temFiltro = filtrosAtivos.length > 0 || atalho !== 'tudo' || !!q;

    const availableCategorias = Array.from(new Set(transactions.filter(t => t.tipo === 'despesa' && t.categorias).map(t => t.categorias.nome))) as string[];
    const availableSubcategorias = Array.from(new Set(transactions.filter(t => t.tipo === 'despesa' && t.subcategorias && (!categoriaFilter.length || categoriaFilter.includes(t.categorias?.nome))).map(t => t.subcategorias.nome))) as string[];
    const availableCarteiras = Array.from(new Set(transactions.map(t => t.carteiras?.nome).filter(Boolean))) as string[];

    // ---------------- números (iguais ao Dashboard) ----------------
    const receitas = filtered.filter(t => t.tipo === 'renda').reduce((s, t) => s + t.valor, 0);
    const despesas = filtered.filter(ehDespesaDoMes).reduce((s, t) => s + t.valor, 0);
    const reserva = filtered.filter(ehReserva).reduce((s, t) => s + t.valor, 0);
    const saldo = temFiltro ? receitas - despesas : receitas - guardado - despesas;

    const pendentes = transactions.filter(t => t.tipo === 'despesa' && t.status === 'pendente');
    const totalPendente = pendentes.reduce((s, t) => s + t.valor, 0);

    const porDia = useMemo(() => {
        const grupos: { data: string; itens: any[]; total: number }[] = [];
        for (const t of filtered) {
            let g = grupos[grupos.length - 1];
            if (!g || g.data !== t.data) { g = { data: t.data, itens: [], total: 0 }; grupos.push(g); }
            g.itens.push(t);
            if (ehDespesaDoMes(t)) g.total += t.valor;
        }
        return grupos;
    }, [filtered]);

    const card = "bg-cards border border-borders rounded-2xl";

    return (
        <div className="space-y-4 animate-in fade-in duration-500 max-w-4xl mx-auto">
            <header className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm text-foreground/60">{formatMonth(activeMonth)}</p>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight">Lançamentos</h1>
                </div>
                <button onClick={() => { setTransactionToEdit(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-brand-green text-[#0f131a] px-4 py-2.5 rounded-xl font-bold hover:bg-brand-green/90 transition-all">
                    <Plus className="w-5 h-5" /> Novo <span className="hidden md:inline text-[#0f131a]/60 text-xs border border-[#0f131a]/30 rounded px-1.5 py-0.5">N</span>
                </button>
            </header>

            {/* Resumo */}
            <section className={`${card} p-4 grid grid-cols-3 gap-3`}>
                <Resumo rotulo="Receitas" valor={receitas} cor="text-brand-green" />
                <Resumo rotulo="Despesas" valor={despesas} cor="text-brand-red" />
                <Resumo rotulo={temFiltro ? "Saldo do filtro" : "Sobra do mês"} valor={saldo} cor={saldo < 0 ? "text-brand-red" : "text-white"} />
                <p className="col-span-3 text-xs text-foreground/50">
                    {temFiltro ? "Receitas menos despesas do que está filtrado." : `Mesma conta do Dashboard${guardado ? `, já descontando ${formatCurrency(guardado)} guardados nas caixinhas` : ""}.`}
                    {reserva > 0 && <> Pago com a reserva: <span className="text-brand-blue font-bold">{formatCurrency(reserva)}</span> (fica à parte).</>}
                </p>
            </section>

            {/* Busca e atalhos */}
            <div className="space-y-2.5">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, valor ou categoria"
                            className="w-full bg-surface border border-borders rounded-xl pl-9 pr-9 py-2.5 text-white outline-none focus:border-brand-green placeholder:text-foreground/30" />
                        {busca && <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-foreground/40 hover:text-white"><X className="w-4 h-4" /></button>}
                    </div>
                    <button onClick={() => setMostrarFiltros(!mostrarFiltros)}
                        className={`flex items-center gap-1.5 px-3 rounded-xl border text-sm font-medium ${mostrarFiltros || filtrosAtivos.length ? "border-brand-green text-brand-green" : "border-borders text-foreground/70 hover:text-white"}`}>
                        <SlidersHorizontal className="w-4 h-4" /><span className="hidden sm:inline">Filtros</span>{filtrosAtivos.length > 0 && <span>({filtrosAtivos.length})</span>}
                    </button>
                    <button onClick={() => (selecionando ? sairDaSelecao() : (setSelecionando(true), setAberto(null)))} title="Selecionar vários"
                        className={`flex items-center gap-1.5 px-3 rounded-xl border text-sm font-medium ${selecionando ? "border-brand-green text-brand-green" : "border-borders text-foreground/70 hover:text-white"}`}>
                        <ListChecks className="w-4 h-4" /><span className="hidden sm:inline">{selecionando ? "Cancelar" : "Selecionar"}</span>
                    </button>
                </div>
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                    {ATALHOS.map(a => (
                        <button key={a.id} onClick={() => setAtalho(a.id)}
                            className={`text-sm px-3.5 py-1.5 rounded-full border whitespace-nowrap transition-colors ${atalho === a.id ? "bg-brand-green text-background border-brand-green font-bold" : "bg-surface border-borders text-foreground/70 hover:text-white"}`}>
                            {a.label}{a.id === 'pendente' && pendentes.length > 0 ? ` (${pendentes.length})` : ""}
                        </button>
                    ))}
                </div>
                {mostrarFiltros && (
                    <div className={`${card} p-4 grid grid-cols-1 sm:grid-cols-2 gap-3`}>
                        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s: string, e: string) => { setStartDate(s); setEndDate(e); }} />
                        {availableCarteiras.length > 0 && <MultiSelect placeholder="Carteiras / Bancos" options={availableCarteiras} selected={carteiraFilter} onChange={setCarteiraFilter} />}
                        {availableCategorias.length > 0 && <MultiSelect placeholder="Categorias" options={availableCategorias} selected={categoriaFilter} onChange={(s) => { setCategoriaFilter(s); setSubcategoriaFilter([]); }} />}
                        {availableSubcategorias.length > 0 && <MultiSelect placeholder="Subcategorias" options={availableSubcategorias} selected={subcategoriaFilter} onChange={setSubcategoriaFilter} />}
                        <label className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer">
                            <input type="checkbox" checked={soParceladas} onChange={e => setSoParceladas(e.target.checked)} className="accent-[#00e5a0] w-4 h-4" /> Só compras parceladas
                        </label>
                    </div>
                )}
                {filtrosAtivos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {filtrosAtivos.map(f => (
                            <button key={f.rotulo} onClick={f.limpar} className="text-xs px-2.5 py-1 rounded-full bg-surface border border-borders text-foreground/80 hover:text-white flex items-center gap-1">
                                {f.rotulo} <X className="w-3 h-3" />
                            </button>
                        ))}
                        <button onClick={() => { setCategoriaFilter([]); setSubcategoriaFilter([]); setCarteiraFilter([]); setSoParceladas(false); setStartDate(""); setEndDate(""); }}
                            className="text-xs px-2 py-1 text-foreground/50 hover:text-white">Limpar tudo</button>
                    </div>
                )}
            </div>

            {/* A pagar */}
            {pendentes.length > 0 && atalho !== 'pendente' && (
                <section className="rounded-2xl p-4 border" style={{ background: 'rgba(255,201,77,0.06)', borderColor: 'rgba(255,201,77,0.3)' }}>
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-brand-yellow" />A pagar: {pendentes.length} {pendentes.length === 1 ? "conta" : "contas"} · {formatCurrency(totalPendente)}</p>
                        <button onClick={() => setAtalho('pendente')} className="text-xs font-bold text-brand-yellow">Ver</button>
                    </div>
                    <div className="mt-2 space-y-1.5">
                        {pendentes.slice(0, 3).map(t => (
                            <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-foreground/80 truncate">{t.data.slice(8, 10)}/{t.data.slice(5, 7)} · {t.descricao}</span>
                                <span className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-white font-bold">{formatCurrency(t.valor)}</span>
                                    <button onClick={() => alternarStatus(t)} className="text-xs font-bold px-2 py-1 rounded-lg border border-brand-green text-brand-green">Pago</button>
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {aviso && <p className="text-sm text-brand-green font-bold">{aviso}</p>}

            {/* Lista por dia */}
            <section className={`${card} overflow-hidden`}>
                {loading ? (
                    <div className="p-8 text-center text-foreground/50">Carregando lançamentos...</div>
                ) : porDia.length === 0 ? (
                    <div className="p-12 text-center text-foreground/50 flex flex-col items-center">
                        <div className="w-14 h-14 bg-surface rounded-full flex items-center justify-center mb-3 border border-borders"><Filter className="w-7 h-7 text-foreground/30" /></div>
                        <p className="font-semibold text-white mb-1">{atalho === 'pendente' ? "Nenhuma conta pendente" : "Nenhum lançamento encontrado"}</p>
                        <p className="text-sm">{temFiltro ? "Tente mudar a busca ou os filtros." : "Toque em Novo para lançar."}</p>
                    </div>
                ) : porDia.map(g => (
                    <div key={g.data}>
                        <div className="flex justify-between items-center px-4 pt-4 pb-1.5 text-xs">
                            <span className="font-bold text-white capitalize flex items-center gap-2">
                                {selecionando && (() => {
                                    const todos = g.itens.every(t => selecionados.has(t.id));
                                    return (
                                        <button onClick={() => { const n = new Set(selecionados); g.itens.forEach(t => todos ? n.delete(t.id) : n.add(t.id)); setSelecionados(n); }}
                                            className="text-brand-green font-bold">{todos ? "Desmarcar dia" : "Marcar dia"}</button>
                                    );
                                })()}
                                {nomeDoDia(g.data)}
                            </span>
                            {g.total > 0 && <span className="text-foreground/50">−{formatCurrency(g.total)}</span>}
                        </div>
                        {g.itens.map(t => (
                            <Linha key={t.id} t={t} aberto={!selecionando && aberto === t.id}
                                selecao={selecionando ? selecionados.has(t.id) : undefined}
                                onToggle={() => selecionando ? alternarSelecao(t.id) : setAberto(aberto === t.id ? null : t.id)}
                                onEditar={() => { setTransactionToEdit(t); setIsModalOpen(true); setAberto(null); }}
                                onDuplicar={() => duplicar(t)} onStatus={() => alternarStatus(t)} onExcluir={() => handleDelete(t)} />
                        ))}
                    </div>
                ))}
            </section>

            {selecionando && (
                <div className="sticky bottom-4 z-30">
                    <div className="bg-surface border border-brand-green rounded-2xl shadow-2xl p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-white font-bold">
                                {selecionados.size} {selecionados.size === 1 ? "selecionado" : "selecionados"}
                                {selecionados.size > 0 && <span className="text-foreground/60 font-normal"> · {formatCurrency(itensSelecionados().reduce((s, t) => s + (t.tipo === 'renda' ? t.valor : -t.valor), 0))}</span>}
                            </span>
                            <button onClick={() => setSelecionados(new Set(filtered.map(t => t.id)))} className="text-xs font-bold text-brand-green">
                                Marcar todos ({filtered.length})
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <BotaoLote disabled={!selecionados.size} onClick={() => { carregarOpcoes(); setAcaoLote('categoria'); }} icone={<TagIcon className="w-3.5 h-3.5" />}>Categoria</BotaoLote>
                            <BotaoLote disabled={!selecionados.size} onClick={() => { carregarOpcoes(); setAcaoLote('carteira'); }} icone={<Wallet className="w-3.5 h-3.5" />}>Carteira</BotaoLote>
                            <BotaoLote disabled={!selecionados.size} onClick={() => loteStatus('pago')} icone={<CheckCircle2 className="w-3.5 h-3.5" />}>Pago</BotaoLote>
                            <BotaoLote disabled={!selecionados.size} onClick={() => loteStatus('pendente')} icone={<Clock className="w-3.5 h-3.5" />}>Pendente</BotaoLote>
                            <BotaoLote disabled={!selecionados.size} onClick={loteExcluir} icone={<Trash2 className="w-3.5 h-3.5" />} perigo>Excluir</BotaoLote>
                        </div>
                    </div>
                </div>
            )}

            {acaoLote && (
                <LoteModal
                    tipo={acaoLote}
                    opcoes={opcoes}
                    itens={itensSelecionados()}
                    onClose={() => setAcaoLote(null)}
                    onAplicar={(campos) => aplicarEmLote(campos, acaoLote === 'categoria' ? itensSelecionados().filter(t => t.tipo === 'despesa') : itensSelecionados(), true)}
                />
            )}

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setTransactionToEdit(null); }}
                onSuccess={() => fetchTransactions()}
                transactionToEdit={transactionToEdit}
            />
        </div>
    );
}

function Resumo({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] uppercase font-bold tracking-wider text-foreground/50">{rotulo}</p>
            <p className={`text-sm sm:text-lg font-bold truncate ${cor}`}>{formatCurrency(valor)}</p>
        </div>
    );
}

function Linha({ t, aberto, selecao, onToggle, onEditar, onDuplicar, onStatus, onExcluir }: {
    t: any; aberto: boolean; selecao?: boolean; onToggle: () => void; onEditar: () => void; onDuplicar: () => void; onStatus: () => void; onExcluir: () => void;
}) {
    const renda = t.tipo === 'renda';
    const reserva = ehReserva(t);
    const cor = renda ? '#00e5a0' : (t.categorias?.cor || '#94a3b8');
    const detalhe = renda
        ? [t.fontes_renda?.nome || "Receita", t.carteiras?.nome]
        : reserva
            ? ["Reserva de emergência", t.carteiras?.nome]
            : [t.categorias?.nome || "Sem categoria", t.subcategorias?.nome, t.carteiras?.nome];

    return (
        <div className={aberto ? "bg-white/[0.03]" : ""}>
            <button onClick={onToggle} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors ${selecao ? "bg-white/[0.04]" : ""}`}>
                {selecao !== undefined && (
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${selecao ? "bg-brand-green border-brand-green text-background" : "border-foreground/30"}`}>
                        {selecao && <Check className="w-3.5 h-3.5" />}
                    </span>
                )}
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{ backgroundColor: `${cor}22`, color: cor }}>
                    {renda ? <ArrowUpCircle className="w-5 h-5" /> : (t.categorias?.icone || "•")}
                </span>
                <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-white truncate">{t.descricao}</span>
                        {reserva && <Tag cor="#4d9fff">Reserva</Tag>}
                        {t.status === 'pendente' && <Tag cor="#ffc94d">Pendente</Tag>}
                        {t.parcela_total > 1 && <Tag cor="#b57bff">{t.parcela_atual}/{t.parcela_total}</Tag>}
                    </span>
                    <span className="block text-xs text-foreground/50 truncate">{detalhe.filter(Boolean).join(" · ")}</span>
                </span>
                <span className={`font-bold whitespace-nowrap ${renda ? "text-brand-green" : reserva ? "text-brand-blue" : "text-white"}`}>
                    {renda ? "+" : "−"}{formatCurrency(t.valor)}
                </span>
            </button>
            {aberto && (
                <div className="flex flex-wrap gap-2 px-4 pb-3 pl-[68px]">
                    <Acao onClick={onEditar} icone={<Pencil className="w-3.5 h-3.5" />}>Editar</Acao>
                    <Acao onClick={onDuplicar} icone={<Copy className="w-3.5 h-3.5" />}>Duplicar</Acao>
                    <Acao onClick={onStatus} icone={t.status === 'pago' ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}>
                        {t.status === 'pago' ? "Marcar pendente" : (renda ? "Marcar recebido" : "Marcar pago")}
                    </Acao>
                    <Acao onClick={onExcluir} icone={<Trash2 className="w-3.5 h-3.5" />} perigo>Excluir</Acao>
                </div>
            )}
        </div>
    );
}

function Tag({ cor, children }: { cor: string; children: React.ReactNode }) {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap flex-shrink-0" style={{ backgroundColor: `${cor}22`, color: cor }}>{children}</span>;
}

function Acao({ onClick, icone, children, perigo = false }: { onClick: () => void; icone: React.ReactNode; children: React.ReactNode; perigo?: boolean }) {
    return (
        <button onClick={onClick} style={perigo ? { borderColor: 'rgba(255,77,77,0.45)' } : undefined}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border flex items-center gap-1.5 hover:bg-white/5 ${perigo ? "text-brand-red" : "border-borders text-foreground/80 hover:text-white"}`}>
            {icone}{children}
        </button>
    );
}

function BotaoLote({ onClick, icone, children, perigo = false, disabled = false }: { onClick: () => void; icone: React.ReactNode; children: React.ReactNode; perigo?: boolean; disabled?: boolean }) {
    return (
        <button onClick={onClick} disabled={disabled} style={perigo ? { borderColor: 'rgba(255,77,77,0.45)' } : undefined}
            className={`text-xs font-bold px-3 py-2 rounded-lg border flex items-center gap-1.5 disabled:opacity-40 hover:bg-white/5 ${perigo ? "text-brand-red" : "border-borders text-white"}`}>
            {icone}{children}
        </button>
    );
}

function LoteModal({ tipo, opcoes, itens, onClose, onAplicar }: {
    tipo: 'categoria' | 'carteira';
    opcoes: { categorias: any[]; subcategorias: any[]; carteiras: any[] } | null;
    itens: any[];
    onClose: () => void;
    onAplicar: (campos: Record<string, any>) => void;
}) {
    const [categoriaId, setCategoriaId] = useState("");
    const [subcategoriaId, setSubcategoriaId] = useState("");
    const [carteiraId, setCarteiraId] = useState("");
    const receitas = itens.filter(t => t.tipo === 'renda').length;
    const parceladas = new Set(itens.map(t => t.group_id).filter(Boolean)).size;
    const subs = (opcoes?.subcategorias || []).filter(s => s.categoria_id === categoriaId);
    const select = "w-full bg-background border border-borders rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-green";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-cards border border-borders rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-heading font-bold text-white">{tipo === 'categoria' ? "Mudar categoria" : "Mudar carteira"}</h2>
                    <button onClick={onClose} className="p-1 text-foreground/50 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                {!opcoes ? <p className="text-sm text-foreground/50 animate-pulse">Carregando...</p> : tipo === 'categoria' ? (
                    <>
                        <select value={categoriaId} onChange={e => { setCategoriaId(e.target.value); setSubcategoriaId(""); }} className={select}>
                            <option value="">Escolha a categoria</option>
                            {opcoes.categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                        </select>
                        {subs.length > 0 && (
                            <select value={subcategoriaId} onChange={e => setSubcategoriaId(e.target.value)} className={select}>
                                <option value="">Sem subcategoria</option>
                                {subs.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                            </select>
                        )}
                        {receitas > 0 && <p className="text-xs text-brand-yellow">{receitas} {receitas === 1 ? "receita selecionada fica" : "receitas selecionadas ficam"} de fora (receita usa fonte de renda, não categoria).</p>}
                    </>
                ) : (
                    <select value={carteiraId} onChange={e => setCarteiraId(e.target.value)} className={select}>
                        <option value="">Escolha a carteira</option>
                        {opcoes.carteiras.map(w => <option key={w.id} value={w.id}>{w.nome}</option>)}
                    </select>
                )}
                {parceladas > 0 && <p className="text-xs text-foreground/60">Em compra parcelada, a mudança vale para todas as parcelas.</p>}
                <button
                    disabled={tipo === 'categoria' ? !categoriaId : !carteiraId}
                    onClick={() => onAplicar(tipo === 'categoria' ? { categoria_id: categoriaId, subcategoria_id: subcategoriaId || null } : { carteira_id: carteiraId })}
                    className="w-full font-bold py-3 rounded-xl bg-brand-green text-background disabled:opacity-40">
                    Aplicar em {tipo === 'categoria' ? itens.length - receitas : itens.length} {(tipo === 'categoria' ? itens.length - receitas : itens.length) === 1 ? "lançamento" : "lançamentos"}
                </button>
            </div>
        </div>
    );
}
