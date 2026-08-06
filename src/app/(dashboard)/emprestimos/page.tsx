"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { formatMonth, formatCurrency } from "@/lib/format";
import {
    HandCoins, Plus, Trash2, Edit2, Check, X, Clock, CheckCircle2,
    ArrowDownCircle, ArrowUpCircle, AlertTriangle, ChevronDown, ChevronUp
} from "lucide-react";

interface Emprestimo {
    id: string;
    descricao: string;
    pessoa: string;
    valor_original: number;
    valor_devolvido: number;
    data_emprestimo: string;
    data_quitacao: string | null;
    status: 'aberto' | 'parcial' | 'quitado';
    observacao: string | null;
}

interface Devolucao {
    id: string;
    emprestimo_id: string;
    valor: number;
    data: string;
    observacao: string | null;
}

export default function EmprestimosPage() {
    const { user } = useAuth();
    const { activeMonth } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [devolucoes, setDevolucoes] = useState<Record<string, Devolucao[]>>({});

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [descricao, setDescricao] = useState("");
    const [pessoa, setPessoa] = useState("");
    const [valorOriginal, setValorOriginal] = useState("");
    const [dataEmprestimo, setDataEmprestimo] = useState(new Date().toISOString().split('T')[0]);
    const [observacao, setObservacao] = useState("");

    const [showDevForm, setShowDevForm] = useState<string | null>(null);
    const [devValor, setDevValor] = useState("");
    const [devData, setDevData] = useState(new Date().toISOString().split('T')[0]);
    const [devObs, setDevObs] = useState("");

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('emprestimos')
            .select('*')
            .eq('user_id', user!.id)
            .order('data_emprestimo', { ascending: false });

        if (data) setEmprestimos(data);
        setLoading(false);
    };

    const fetchDevolucoes = async (emprestimoId: string) => {
        const { data } = await supabase
            .from('devolucoes')
            .select('*')
            .eq('emprestimo_id', emprestimoId)
            .eq('user_id', user!.id)
            .order('data', { ascending: false });

        if (data) setDevolucoes(prev => ({ ...prev, [emprestimoId]: data }));
    };

    const toggleExpand = async (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
        } else {
            setExpandedId(id);
            if (!devolucoes[id]) await fetchDevolucoes(id);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setShowForm(false);
        setDescricao("");
        setPessoa("");
        setValorOriginal("");
        setDataEmprestimo(new Date().toISOString().split('T')[0]);
        setObservacao("");
    };

    const handleEdit = (emp: Emprestimo) => {
        setEditingId(emp.id);
        setDescricao(emp.descricao);
        setPessoa(emp.pessoa);
        setValorOriginal(String(emp.valor_original));
        setDataEmprestimo(emp.data_emprestimo);
        setObservacao(emp.observacao || "");
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !descricao || !pessoa || !valorOriginal) return;
        setIsSubmitting(true);

        const parsed = parseFloat(valorOriginal.replace(',', '.'));

        if (editingId) {
            const { error } = await supabase
                .from('emprestimos')
                .update({ descricao, pessoa, valor_original: parsed, data_emprestimo: dataEmprestimo, observacao: observacao || null })
                .eq('id', editingId)
                .eq('user_id', user.id);

            if (!error) {
                setEmprestimos(emprestimos.map(e =>
                    e.id === editingId ? { ...e, descricao, pessoa, valor_original: parsed, data_emprestimo: dataEmprestimo, observacao: observacao || null } : e
                ));
                resetForm();
            }
        } else {
            const { data: newEmp, error } = await supabase
                .from('emprestimos')
                .insert({ user_id: user.id, descricao, pessoa, valor_original: parsed, data_emprestimo: dataEmprestimo, observacao: observacao || null })
                .select()
                .single();

            if (!error && newEmp) {
                setEmprestimos([newEmp, ...emprestimos]);
                resetForm();
            }
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este empréstimo?")) return;
        const { error } = await supabase.from('emprestimos').delete().eq('id', id).eq('user_id', user!.id);
        if (!error) setEmprestimos(emprestimos.filter(e => e.id !== id));
    };

    const handleDevolucao = async (e: React.FormEvent, emprestimoId: string) => {
        e.preventDefault();
        if (!user || !devValor) return;
        setIsSubmitting(true);

        const valor = parseFloat(devValor.replace(',', '.'));
        const emp = emprestimos.find(e => e.id === emprestimoId)!;
        const novoDevolvido = emp.valor_devolvido + valor;
        const novoStatus = novoDevolvido >= emp.valor_original ? 'quitado' : 'parcial';

        const { data: newDev, error: devError } = await supabase
            .from('devolucoes')
            .insert({ emprestimo_id: emprestimoId, user_id: user.id, valor, data: devData, observacao: devObs || null })
            .select()
            .single();

        if (!devError && newDev) {
            await supabase
                .from('emprestimos')
                .update({
                    valor_devolvido: novoDevolvido,
                    status: novoStatus,
                    data_quitacao: novoStatus === 'quitado' ? devData : null,
                })
                .eq('id', emprestimoId)
                .eq('user_id', user.id);

            setEmprestimos(emprestimos.map(e =>
                e.id === emprestimoId
                    ? { ...e, valor_devolvido: novoDevolvido, status: novoStatus as any, data_quitacao: novoStatus === 'quitado' ? devData : null }
                    : e
            ));
            setDevolucoes(prev => ({
                ...prev,
                [emprestimoId]: [newDev, ...(prev[emprestimoId] || [])]
            }));
            setShowDevForm(null);
            setDevValor("");
            setDevData(new Date().toISOString().split('T')[0]);
            setDevObs("");
        }
        setIsSubmitting(false);
    };

    const totalAberto = emprestimos.filter(e => e.status !== 'quitado').reduce((acc, e) => acc + (e.valor_original - e.valor_devolvido), 0);
    const totalQuitado = emprestimos.filter(e => e.status === 'quitado').reduce((acc, e) => acc + e.valor_original, 0);
    const abertos = emprestimos.filter(e => e.status !== 'quitado');
    const quitados = emprestimos.filter(e => e.status === 'quitado');

    if (loading) return <div className="p-8 text-foreground/50 animate-pulse">Carregando empréstimos...</div>;

    const statusBadge = (status: string) => {
        switch (status) {
            case 'aberto': return <span className="text-xs px-2 py-0.5 rounded-full bg-brand-red/10 text-brand-red font-bold">Aberto</span>;
            case 'parcial': return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 font-bold">Parcial</span>;
            case 'quitado': return <span className="text-xs px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green font-bold">Quitado</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="pb-6 border-b border-borders flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
                        <HandCoins className="text-yellow-400 w-6 h-6" /> Empréstimos
                    </h1>
                    <p className="text-foreground/60 mt-1">Controle de dinheiro emprestado e devoluções.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="bg-brand-blue hover:bg-brand-blue/90 text-background font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-transform active:scale-95"
                >
                    <Plus className="w-4 h-4" /> Novo Empréstimo
                </button>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-brand-red/5 border border-brand-red/20 rounded-2xl p-5">
                    <p className="text-sm text-foreground/60 mb-1">Total a Receber</p>
                    <p className="text-2xl font-bold text-brand-red">{formatCurrency(totalAberto)}</p>
                    <p className="text-xs text-foreground/40 mt-1">{abertos.length} empréstimo{abertos.length !== 1 ? 's' : ''} aberto{abertos.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-brand-green/5 border border-brand-green/20 rounded-2xl p-5">
                    <p className="text-sm text-foreground/60 mb-1">Total Quitado</p>
                    <p className="text-2xl font-bold text-brand-green">{formatCurrency(totalQuitado)}</p>
                    <p className="text-xs text-foreground/40 mt-1">{quitados.length} quitado{quitados.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-2xl p-5">
                    <p className="text-sm text-foreground/60 mb-1">Total Geral</p>
                    <p className="text-2xl font-bold text-brand-blue">{formatCurrency(totalAberto + totalQuitado)}</p>
                    <p className="text-xs text-foreground/40 mt-1">{emprestimos.length} no total</p>
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
                    <div className="bg-cards border border-borders rounded-2xl p-6 w-full max-w-md space-y-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-heading font-bold text-white text-lg">
                                {editingId ? 'Editar Empréstimo' : 'Novo Empréstimo'}
                            </h3>
                            <button onClick={resetForm} className="text-foreground/50 hover:text-white p-1"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-foreground/70 mb-1">Pessoa</label>
                                <input type="text" required value={pessoa} onChange={e => setPessoa(e.target.value)} placeholder="Para quem emprestou" className="w-full bg-surface border border-borders rounded-xl px-4 py-2.5 text-white outline-none focus:border-brand-blue transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground/70 mb-1">Descrição</label>
                                <input type="text" required value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Empréstimo pessoal" className="w-full bg-surface border border-borders rounded-xl px-4 py-2.5 text-white outline-none focus:border-brand-blue transition-all" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-foreground/70 mb-1">Valor</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 text-sm">R$</span>
                                        <input type="number" step="0.01" min="0.01" required value={valorOriginal} onChange={e => setValorOriginal(e.target.value)} className="w-full bg-surface border border-borders rounded-xl pl-10 pr-4 py-2.5 text-white outline-none focus:border-brand-blue transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground/70 mb-1">Data</label>
                                    <input type="date" required value={dataEmprestimo} onChange={e => setDataEmprestimo(e.target.value)} className="w-full bg-surface border border-borders rounded-xl px-4 py-2.5 text-white outline-none focus:border-brand-blue transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground/70 mb-1">Observação (opcional)</label>
                                <textarea rows={2} value={observacao} onChange={e => setObservacao(e.target.value)} className="w-full bg-surface border border-borders rounded-xl px-4 py-2 text-white outline-none focus:border-brand-blue transition-all resize-none text-sm" />
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue hover:bg-brand-blue/90 text-background font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50">
                                {isSubmitting ? 'Salvando...' : <>{editingId ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />} {editingId ? 'Atualizar' : 'Registrar'}</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Empréstimos Abertos */}
            <div className="space-y-3">
                <h3 className="font-heading font-bold text-white text-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" /> Pendentes ({abertos.length})
                </h3>
                {abertos.length === 0 ? (
                    <div className="text-center py-12 bg-cards rounded-2xl border border-dashed border-borders">
                        <HandCoins className="w-10 h-10 text-foreground/30 mx-auto mb-3" />
                        <p className="text-foreground/50">Nenhum empréstimo pendente</p>
                    </div>
                ) : (
                    abertos.map(emp => (
                        <div key={emp.id} className="bg-cards border border-borders rounded-2xl overflow-hidden">
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400 flex-shrink-0">
                                            <HandCoins className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white truncate">{emp.pessoa}</p>
                                            <p className="text-xs text-foreground/50 truncate">{emp.descricao}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {statusBadge(emp.status)}
                                        <button onClick={() => handleEdit(emp)} className="p-2 text-foreground/40 hover:text-brand-blue rounded-lg hover:bg-white/5 transition-all"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(emp.id)} className="p-2 text-foreground/40 hover:text-brand-red rounded-lg hover:bg-white/5 transition-all"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-end justify-between">
                                    <div>
                                        <p className="text-xs text-foreground/40">Valor Original</p>
                                        <p className="text-lg font-bold text-white">{formatCurrency(emp.valor_original)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-foreground/40">Resta</p>
                                        <p className="text-lg font-bold text-brand-red">{formatCurrency(emp.valor_original - emp.valor_devolvido)}</p>
                                    </div>
                                </div>

                                {/* Barra de progresso */}
                                <div className="mt-3">
                                    <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-brand-green rounded-full transition-all"
                                            style={{ width: `${Math.min((emp.valor_devolvido / emp.valor_original) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-foreground/40 mt-1">{((emp.valor_devolvido / emp.valor_original) * 100).toFixed(0)}% devolvido — {new Date(emp.data_emprestimo + "T00:00:00").toLocaleDateString('pt-BR')}</p>
                                </div>

                                <div className="mt-3 flex gap-2">
                                    <button
                                        onClick={() => setShowDevForm(showDevForm === emp.id ? null : emp.id)}
                                        className="bg-brand-green/10 hover:bg-brand-green/20 text-brand-green border border-brand-green/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                                    >
                                        <ArrowDownCircle className="w-3 h-3" /> Registrar Devolução
                                    </button>
                                    <button
                                        onClick={() => toggleExpand(emp.id)}
                                        className="bg-surface hover:bg-white/5 text-foreground/60 border border-borders px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                                    >
                                        {expandedId === emp.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Histórico
                                    </button>
                                </div>

                                {/* Formulário de devolução inline */}
                                {showDevForm === emp.id && (
                                    <form onSubmit={e => handleDevolucao(e, emp.id)} className="mt-3 p-3 bg-surface border border-brand-green/20 rounded-xl space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-medium text-foreground/50 mb-0.5">Valor</label>
                                                <input type="number" step="0.01" min="0.01" max={emp.valor_original - emp.valor_devolvido} required value={devValor} onChange={e => setDevValor(e.target.value)} className="w-full bg-background border border-borders rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-brand-green" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-foreground/50 mb-0.5">Data</label>
                                                <input type="date" required value={devData} onChange={e => setDevData(e.target.value)} className="w-full bg-background border border-borders rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-brand-green" />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="submit" disabled={isSubmitting} className="bg-brand-green hover:bg-brand-green/90 text-background font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1 disabled:opacity-50">
                                                <Check className="w-3 h-3" /> Confirmar
                                            </button>
                                            <button type="button" onClick={() => setShowDevForm(null)} className="text-foreground/50 hover:text-white px-3 py-1.5 text-xs">Cancelar</button>
                                        </div>
                                    </form>
                                )}
                            </div>

                            {/* Histórico de devoluções expandido */}
                            {expandedId === emp.id && (
                                <div className="border-t border-borders bg-surface/50 p-4 space-y-2">
                                    <p className="text-xs font-bold text-foreground/40 uppercase tracking-wider">Devoluções</p>
                                    {(!devolucoes[emp.id] || devolucoes[emp.id].length === 0) ? (
                                        <p className="text-xs text-foreground/40">Nenhuma devolução registrada.</p>
                                    ) : (
                                        devolucoes[emp.id].map(dev => (
                                            <div key={dev.id} className="flex items-center justify-between py-1.5 border-b border-borders/30 last:border-0">
                                                <div className="flex items-center gap-2">
                                                    <ArrowUpCircle className="w-3 h-3 text-brand-green" />
                                                    <span className="text-sm text-white">{formatCurrency(dev.valor)}</span>
                                                    {dev.observacao && <span className="text-xs text-foreground/40">— {dev.observacao}</span>}
                                                </div>
                                                <span className="text-xs text-foreground/40">{new Date(dev.data + "T00:00:00").toLocaleDateString('pt-BR')}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Empréstimos Quitados */}
            {quitados.length > 0 && (
                <div className="space-y-3 opacity-70">
                    <h3 className="font-heading font-bold text-white text-sm uppercase tracking-wider pl-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-brand-green" /> Quitados ({quitados.length})
                    </h3>
                    {quitados.map(emp => (
                        <div key={emp.id} className="bg-cards border border-borders rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white text-sm">{emp.pessoa}</p>
                                    <p className="text-xs text-foreground/40">{emp.descricao}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-brand-green text-sm">{formatCurrency(emp.valor_original)}</p>
                                {emp.data_quitacao && <p className="text-[10px] text-foreground/40">Quitado em {new Date(emp.data_quitacao + "T00:00:00").toLocaleDateString('pt-BR')}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
