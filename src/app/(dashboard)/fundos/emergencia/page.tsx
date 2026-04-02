"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import {
    ShieldAlert, Plus, Trash2, Edit2, X, Check, ArrowLeft, Calendar, AlertTriangle
} from "lucide-react";
import Link from "next/link";

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateString: string) {
    if (!dateString) return "";
    const [year, month, day] = dateString.substring(0, 10).split('-');
    return `${day}/${month}/${year}`;
}

interface EmergenciaGasto {
    id: string;
    descricao: string;
    valor: number;
    data: string;
    status: string;
    carteira_id: string | null;
    carteiras?: { nome: string };
}

export default function EmergenciaGastosPage() {
    const { user } = useAuth();
    const { activeMonth } = useAppStore();

    const [gastos, setGastos] = useState<EmergenciaGasto[]>([]);
    const [saldoEmergencia, setSaldoEmergencia] = useState(0);
    const [loading, setLoading] = useState(true);
    const [carteiras, setCarteiras] = useState<any[]>([]);
    const [categoriaEmergenciaId, setCategoriaEmergenciaId] = useState<string | null>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGasto, setEditingGasto] = useState<EmergenciaGasto | null>(null);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [descricao, setDescricao] = useState("");
    const [valor, setValor] = useState("");
    const [dataStr, setDataStr] = useState(new Date().toISOString().split('T')[0]);
    const [carteiraId, setCarteiraId] = useState("");
    const [status, setStatus] = useState<'pago' | 'pendente'>('pago');

    useEffect(() => {
        if (user && activeMonth) fetchData();
    }, [user, activeMonth]);

    const fetchData = async () => {
        setLoading(true);

        // Load emergency fund balance
        const { data: fundos } = await supabase
            .from('fundos')
            .select('emergencia_saldo')
            .eq('user_id', user!.id)
            .single();
        if (fundos) setSaldoEmergencia(fundos.emergencia_saldo || 0);

        // Load the "Emergência" category ID
        const { data: cats } = await supabase
            .from('categorias')
            .select('id, nome')
            .eq('user_id', user!.id)
            .ilike('nome', 'emergência');
        if (cats && cats.length > 0) {
            setCategoriaEmergenciaId(cats[0].id);
        } else {
            // Try to find it case-insensitively
            const { data: allCats } = await supabase
                .from('categorias')
                .select('id, nome')
                .eq('user_id', user!.id);
            const emergCat = allCats?.find(c => c.nome.toLowerCase().includes('emergên') || c.nome.toLowerCase().includes('emergencia'));
            if (emergCat) setCategoriaEmergenciaId(emergCat.id);
        }

        // Load wallets
        const { data: cw } = await supabase.from('carteiras').select('*').eq('user_id', user!.id).eq('ativo', true);
        if (cw) {
            setCarteiras(cw);
            if (cw.length > 0) setCarteiraId(cw[0].id);
        }

        // Load emergency expenses for this month
        const { data: lancamentos } = await supabase
            .from('lancamentos')
            .select('*, carteiras(nome), categorias(nome)')
            .eq('user_id', user!.id)
            .eq('mes', activeMonth)
            .eq('tipo', 'despesa')
            .order('data', { ascending: false });

        // Filter only those with Emergência category
        const emergencias = (lancamentos || []).filter(
            (l: any) => l.categorias?.nome?.toLowerCase().includes('emergên') || l.categorias?.nome?.toLowerCase().includes('emergencia')
        );
        setGastos(emergencias);

        setLoading(false);
    };

    const openCreateModal = () => {
        setEditingGasto(null);
        setDescricao("");
        setValor("");
        setDataStr(new Date().toISOString().split('T')[0]);
        if (carteiras.length > 0) setCarteiraId(carteiras[0].id);
        setStatus('pago');
        setIsModalOpen(true);
    };

    const openEditModal = (gasto: EmergenciaGasto) => {
        setEditingGasto(gasto);
        setDescricao(gasto.descricao);
        setValor(gasto.valor.toString());
        setDataStr(gasto.data?.substring(0, 10) || new Date().toISOString().split('T')[0]);
        setCarteiraId(gasto.carteira_id || (carteiras.length > 0 ? carteiras[0].id : ""));
        setStatus(gasto.status as 'pago' | 'pendente');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !categoriaEmergenciaId) {
            alert("Categoria Emergência não encontrada. Crie-a nas configurações.");
            return;
        }

        setSaving(true);
        const numVal = parseFloat(valor.replace(',', '.')) || 0;
        const mesStr = dataStr.substring(0, 7);

        try {
            if (editingGasto) {
                // Editing: calculate diff for fund adjustment
                const oldVal = parseFloat(editingGasto.valor.toString()) || 0;
                const fundDiff = oldVal - numVal; // positive = refund some, negative = deduct more

                await supabase.from('lancamentos').update({
                    descricao,
                    valor: numVal,
                    data: dataStr,
                    mes: mesStr,
                    carteira_id: carteiraId || null,
                    status,
                    categoria_id: categoriaEmergenciaId,
                }).eq('id', editingGasto.id);

                // Adjust fund balance
                if (fundDiff !== 0) {
                    const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user!.id).single();
                    if (f) {
                        await supabase.from('fundos').update({
                            emergencia_saldo: Math.max(0, parseFloat(f.emergencia_saldo || "0") + fundDiff)
                        }).eq('id', f.id);
                    }
                }
            } else {
                // Creating new: deduct from emergency fund
                await supabase.from('lancamentos').insert({
                    user_id: user.id,
                    tipo: 'despesa',
                    descricao,
                    valor: numVal,
                    data: dataStr,
                    mes: mesStr,
                    carteira_id: carteiraId || null,
                    status,
                    categoria_id: categoriaEmergenciaId,
                    recorrente: false,
                });

                // Deduct from emergency fund
                const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user!.id).single();
                if (f) {
                    await supabase.from('fundos').update({
                        emergencia_saldo: Math.max(0, parseFloat(f.emergencia_saldo || "0") - numVal)
                    }).eq('id', f.id);
                }
            }

            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar gasto de emergência.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (gasto: EmergenciaGasto) => {
        if (!confirm(`Excluir "${gasto.descricao}"? O valor será devolvido ao Fundo de Emergência.`)) return;

        try {
            await supabase.from('lancamentos').delete().eq('id', gasto.id);

            // Refund emergency fund
            const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user!.id).single();
            if (f) {
                await supabase.from('fundos').update({
                    emergencia_saldo: parseFloat(f.emergencia_saldo || "0") + gasto.valor
                }).eq('id', f.id);
            }

            fetchData();
        } catch (err) {
            console.error(err);
            alert("Erro ao excluir gasto.");
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'pago' ? 'pendente' : 'pago';
        await supabase.from('lancamentos').update({ status: newStatus }).eq('id', id);
        fetchData();
    };

    const totalGastosEmergencia = gastos.reduce((acc, g) => acc + g.valor, 0);

    if (loading) return <div className="p-8 animate-pulse text-foreground/50">Carregando gastos de emergência...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <header className="pb-6 border-b border-borders">
                <div className="flex items-center gap-3 mb-2">
                    <Link
                        href="/fundos"
                        className="p-2 text-foreground/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        title="Voltar para Fundos"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
                            <ShieldAlert className="text-brand-yellow w-6 h-6" />
                            Gastos de Emergência
                        </h1>
                        <p className="text-foreground/60 mt-1">
                            Lançamentos debitados diretamente do seu Fundo de Emergência em <span className="text-brand-yellow font-medium">{activeMonth}</span>
                        </p>
                    </div>
                </div>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-brand-yellow/10 border border-brand-yellow/20 rounded-2xl p-5">
                    <p className="text-xs text-brand-yellow font-bold uppercase tracking-wider mb-1">Saldo do Fundo de Emergência</p>
                    <p className="text-2xl font-sans font-bold text-brand-yellow">{formatCurrency(saldoEmergencia)}</p>
                    <p className="text-xs text-foreground/50 mt-1">Saldo acumulado total</p>
                </div>
                <div className="bg-brand-red/10 border border-brand-red/20 rounded-2xl p-5">
                    <p className="text-xs text-brand-red font-bold uppercase tracking-wider mb-1">Gasto em {activeMonth}</p>
                    <p className="text-2xl font-sans font-bold text-brand-red">{formatCurrency(totalGastosEmergencia)}</p>
                    <p className="text-xs text-foreground/50 mt-1">{gastos.length} lançamento(s)</p>
                </div>
                <div className="bg-cards border border-borders rounded-2xl p-5">
                    <p className="text-xs text-foreground/50 font-bold uppercase tracking-wider mb-1">Saldo após gastos do mês</p>
                    <p className={`text-2xl font-sans font-bold ${(saldoEmergencia) >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                        {formatCurrency(saldoEmergencia)}
                    </p>
                    <p className="text-xs text-foreground/50 mt-1">Já descontado dos gastos</p>
                </div>
            </div>

            {/* Warning */}
            {!categoriaEmergenciaId && (
                <div className="bg-brand-red/10 border border-brand-red/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="text-brand-red w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-bold text-brand-red">Categoria "Emergência" não encontrada!</p>
                        <p className="text-foreground/70 mt-1">Crie uma categoria chamada "Emergência" em <strong>Configurações → Categorias</strong> para poder registrar gastos aqui.</p>
                    </div>
                </div>
            )}

            {/* Action button */}
            <div className="flex justify-end">
                <button
                    onClick={openCreateModal}
                    disabled={!categoriaEmergenciaId}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-yellow text-background rounded-xl font-bold hover:bg-brand-yellow/90 transition-all shadow-lg shadow-brand-yellow/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus className="w-4 h-4" />
                    Registrar Gasto de Emergência
                </button>
            </div>

            {/* Expenses list */}
            <div className="bg-cards border border-borders rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-borders">
                    <h2 className="font-heading font-bold text-white">Gastos de Emergência — {activeMonth}</h2>
                    <p className="text-sm text-foreground/50 mt-0.5">Cada gasto aqui é debitado diretamente do Fundo de Emergência e aparece nas Despesas Totais do Dashboard.</p>
                </div>

                {gastos.length === 0 ? (
                    <div className="p-12 text-center text-foreground/50 flex flex-col items-center">
                        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4 border border-borders">
                            <ShieldAlert className="w-8 h-8 text-foreground/30" />
                        </div>
                        <p className="font-semibold text-white mb-1">Nenhum gasto de emergência em {activeMonth}</p>
                        <p className="text-sm">Clique no botão acima para registrar um gasto do fundo de emergência.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-borders">
                        {gastos.map(g => (
                            <div key={g.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 px-6 hover:bg-white/[0.02] transition-colors gap-4">
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-yellow/10 text-brand-yellow">
                                        <ShieldAlert className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-[180px]">
                                        <div className="flex items-center gap-2.5 mb-0.5">
                                            <p className="font-semibold text-white truncate">{g.descricao}</p>
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/[0.03] text-foreground/50 border border-white/10 flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-foreground/40" />
                                                {formatDate(g.data)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-foreground/60">
                                            🚨 Fundo de Emergência
                                            {g.carteiras && (
                                                <span className="ml-2 text-foreground/40">· {g.carteiras.nome}</span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                                    <div className="text-left sm:text-right">
                                        <p className="font-sans font-bold text-lg text-brand-red">
                                            - {formatCurrency(g.valor)}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleToggleStatus(g.id, g.status)}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${g.status === 'pago' ? 'bg-brand-green/10 text-brand-green border-brand-green/20' : 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/20'}`}
                                        >
                                            {g.status.toUpperCase()}
                                        </button>

                                        <button
                                            onClick={() => openEditModal(g)}
                                            className="p-2 text-foreground/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => handleDelete(g)}
                                            className="p-2 text-foreground/40 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors"
                                            title="Excluir (devolve ao fundo)"
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

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-cards border border-borders rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-borders">
                            <div>
                                <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
                                    <ShieldAlert className="w-5 h-5 text-brand-yellow" />
                                    {editingGasto ? 'Editar Gasto de Emergência' : 'Novo Gasto de Emergência'}
                                </h2>
                                <p className="text-sm text-foreground/50 mt-1">O valor será debitado do Fundo de Emergência</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-foreground/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Fund balance warning */}
                            <div className="mb-5 p-3 bg-brand-yellow/10 border border-brand-yellow/20 rounded-xl flex items-center gap-3">
                                <ShieldAlert className="w-4 h-4 text-brand-yellow flex-shrink-0" />
                                <div className="text-sm">
                                    <span className="text-brand-yellow font-bold">Saldo disponível: </span>
                                    <span className="text-white font-bold">{formatCurrency(saldoEmergencia)}</span>
                                </div>
                            </div>

                            <form id="emerg-form" onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Descrição</label>
                                    <input
                                        required
                                        autoFocus
                                        value={descricao}
                                        onChange={e => setDescricao(e.target.value)}
                                        placeholder="Ex: Conserto do carro, Médico de urgência..."
                                        className="w-full bg-background border border-borders rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-yellow transition-colors"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Valor (R$)</label>
                                        <input
                                            required
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={valor}
                                            onChange={e => setValor(e.target.value)}
                                            placeholder="0,00"
                                            className="w-full bg-background border border-borders rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-yellow transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Data</label>
                                        <input
                                            required
                                            type="date"
                                            value={dataStr}
                                            onChange={e => setDataStr(e.target.value)}
                                            className="w-full bg-background border border-borders rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-yellow transition-colors"
                                        />
                                    </div>
                                </div>

                                {carteiras.length > 0 && (
                                    <div>
                                        <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Carteira / Conta</label>
                                        <select
                                            value={carteiraId}
                                            onChange={e => setCarteiraId(e.target.value)}
                                            className="w-full bg-surface border border-borders rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-yellow [&>option]:bg-surface [&>option]:text-white"
                                        >
                                            {carteiras.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={status === 'pago'}
                                            onChange={e => setStatus(e.target.checked ? 'pago' : 'pendente')}
                                            className="accent-brand-green w-4 h-4"
                                        />
                                        <span className="text-sm text-foreground/90">Já foi pago?</span>
                                    </label>
                                </div>

                                {/* Preview deduction */}
                                {valor && parseFloat(valor.replace(',', '.')) > 0 && (
                                    <div className="p-3 bg-brand-red/10 border border-brand-red/20 rounded-xl text-sm">
                                        <div className="flex justify-between text-foreground/70">
                                            <span>Saldo atual do fundo:</span>
                                            <span className="text-white font-medium">{formatCurrency(saldoEmergencia)}</span>
                                        </div>
                                        <div className="flex justify-between text-foreground/70 mt-1">
                                            <span>{editingGasto ? 'Ajuste:' : 'Este gasto:'}</span>
                                            <span className="text-brand-red font-medium">
                                                {editingGasto
                                                    ? `${(parseFloat(editingGasto.valor.toString()) - parseFloat(valor.replace(',', '.'))) >= 0 ? '+' : '-'} ${formatCurrency(Math.abs(parseFloat(editingGasto.valor.toString()) - parseFloat(valor.replace(',', '.'))))}`
                                                    : `- ${formatCurrency(parseFloat(valor.replace(',', '.')))}`
                                                }
                                            </span>
                                        </div>
                                        <div className="flex justify-between font-bold mt-2 pt-2 border-t border-white/10">
                                            <span className="text-white">Saldo estimado após:</span>
                                            <span className={`${(saldoEmergencia - (editingGasto ? (parseFloat(valor.replace(',', '.')) - parseFloat(editingGasto.valor.toString())) : parseFloat(valor.replace(',', '.')))) >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                                                {formatCurrency(Math.max(0, saldoEmergencia - (editingGasto ? (parseFloat(valor.replace(',', '.')) - parseFloat(editingGasto.valor.toString())) : parseFloat(valor.replace(',', '.')))))}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        <div className="p-6 border-t border-borders bg-surface/50">
                            <button
                                form="emerg-form"
                                type="submit"
                                disabled={saving}
                                className="w-full py-3 rounded-xl font-bold flex justify-center items-center gap-2 bg-brand-yellow text-background hover:bg-brand-yellow/90 transition-all shadow-lg shadow-brand-yellow/20 disabled:opacity-50"
                            >
                                {saving ? (
                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        {editingGasto ? 'Atualizar Gasto' : 'Registrar Gasto'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
