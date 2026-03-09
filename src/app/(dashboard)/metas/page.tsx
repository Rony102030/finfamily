"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { Target, Plus, Check, X, Trash2, Edit2 } from "lucide-react";

interface Meta {
    id: string;
    nome: string;
    valor_total: number;
    valor_atual: number;
    prazo_meses: number;
}

export default function MetasPage() {
    const { user } = useAuth();
    const [metas, setMetas] = useState<Meta[]>([]);
    const [loading, setLoading] = useState(true);

    const [isAdding, setIsAdding] = useState(false);
    const [nome, setNome] = useState("");
    const [valorTotal, setValorTotal] = useState("");
    const [valorAtual, setValorAtual] = useState("");
    const [prazo, setPrazo] = useState("");

    const [editingId, setEditingId] = useState<string | null>(null);
    const [addingValueId, setAddingValueId] = useState<string | null>(null);
    const [valorAdicional, setValorAdicional] = useState("");

    useEffect(() => {
        if (user) fetchMetas();
    }, [user]);

    const fetchMetas = async () => {
        setLoading(true);
        const { data } = await supabase.from('metas').select('*').eq('user_id', user!.id).order('created_at', { ascending: true });
        if (data) setMetas(data);
        setLoading(false);
    };

    const handleAdd = async () => {
        if (!nome.trim() || !valorTotal || !prazo) return;
        const { data } = await supabase.from('metas').insert({
            user_id: user!.id,
            nome,
            valor_total: parseFloat(valorTotal),
            valor_atual: parseFloat(valorAtual) || 0,
            prazo_meses: parseInt(prazo)
        }).select().single();
        if (data) {
            setMetas([...metas, data]);
            setIsAdding(false);
            setNome(""); setValorTotal(""); setValorAtual(""); setPrazo("");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Certeza que deseja excluir esta meta?")) return;
        await supabase.from('metas').delete().eq('id', id);
        setMetas(metas.filter(m => m.id !== id));
    };

    const startEdit = (m: Meta) => {
        setEditingId(m.id);
        setNome(m.nome);
        setValorTotal(m.valor_total.toString());
        setValorAtual(m.valor_atual.toString());
        setPrazo(m.prazo_meses.toString());
    };

    const saveEdit = async (id: string) => {
        const updates = {
            nome,
            valor_total: parseFloat(valorTotal),
            valor_atual: parseFloat(valorAtual) || 0,
            prazo_meses: parseInt(prazo)
        };
        await supabase.from('metas').update(updates).eq('id', id);
        setMetas(metas.map(m => m.id === id ? { ...m, ...updates } : m));
        setEditingId(null);
    };

    const handleAddValue = async (id: string, currentVal: number) => {
        const val = parseFloat(valorAdicional);
        if (isNaN(val) || val <= 0) return;
        const novoValor = currentVal + val;
        await supabase.from('metas').update({ valor_atual: novoValor }).eq('id', id);
        setMetas(metas.map(m => m.id === id ? { ...m, valor_atual: novoValor } : m));
        setAddingValueId(null);
        setValorAdicional("");
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-borders">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
                        <Target className="text-brand-purple w-6 h-6" /> Metas Financeiras
                    </h1>
                    <p className="text-foreground/60 mt-1">
                        Defina objetivos e acompanhe o quanto falta para alcançá-los.
                    </p>
                </div>
                {!isAdding && !editingId && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 bg-brand-green text-background px-5 py-2.5 rounded-xl font-bold hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20"
                    >
                        <Plus className="w-5 h-5" /> Nova Meta
                    </button>
                )}
            </header>

            <div className="space-y-6">
                {(isAdding || editingId) && (
                    <div className="bg-surface border border-brand-green rounded-2xl p-6 mb-8 text-sm max-w-2xl">
                        <h3 className="font-heading font-bold text-white mb-4 text-lg">
                            {isAdding ? "Adicionar Meta" : "Editar Meta"}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-foreground/80 mb-1">Nome da Meta</label>
                                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Viagem para Europa" className="w-full bg-background border border-borders rounded-lg px-4 py-2.5 text-white focus:border-brand-green" />
                            </div>
                            <div>
                                <label className="block text-foreground/80 mb-1">Valor Alvo (R$)</label>
                                <input type="number" step="0.01" value={valorTotal} onChange={e => setValorTotal(e.target.value)} placeholder="10000" className="w-full bg-background border border-borders rounded-lg px-4 py-2.5 text-white focus:border-brand-green" />
                            </div>
                            <div>
                                <label className="block text-foreground/80 mb-1">Valor Atual Guardado (R$)</label>
                                <input type="number" step="0.01" value={valorAtual} onChange={e => setValorAtual(e.target.value)} placeholder="1000" className="w-full bg-background border border-borders rounded-lg px-4 py-2.5 text-white focus:border-brand-green" />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-foreground/80 mb-1">Prazo (em meses)</label>
                                <input type="number" value={prazo} onChange={e => setPrazo(e.target.value)} placeholder="12" className="w-full bg-background border border-borders rounded-lg px-4 py-2.5 text-white focus:border-brand-green" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-6">
                            <button
                                onClick={() => editingId ? saveEdit(editingId) : handleAdd()}
                                className="flex-1 bg-brand-green text-background py-2.5 font-bold rounded-xl"
                            >
                                Salvar Meta
                            </button>
                            <button
                                onClick={() => { setIsAdding(false); setEditingId(null); }}
                                className="flex-1 bg-background border border-borders text-white py-2.5 font-bold rounded-xl"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {!loading && metas.length === 0 && !isAdding && (
                    <div className="text-center py-16 text-foreground/50 border border-dashed border-borders rounded-2xl flex flex-col items-center">
                        <Target className="w-12 h-12 text-foreground/20 mb-4" />
                        <p>Você não possui metas ativas.</p>
                        <p className="text-sm">Clique em "Nova Meta" para começar a planejar seu futuro.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {metas.map(meta => {
                        const progress = Math.min(100, (meta.valor_atual / meta.valor_total) * 100);
                        const remaining = Math.max(0, meta.valor_total - meta.valor_atual);
                        const perMonth = meta.prazo_meses > 0 ? remaining / meta.prazo_meses : 0;
                        const isDone = progress >= 100;

                        return (
                            <div key={meta.id} className="bg-cards border border-borders rounded-2xl p-6 relative group overflow-hidden">
                                {isDone && (
                                    <div className="absolute top-0 right-0 left-0 bg-brand-green/20 text-brand-green text-xs font-bold text-center py-1 uppercase tracking-widest border-b border-brand-green/30">
                                        Meta Alcançada 🎉
                                    </div>
                                )}
                                <div className={`flex justify-between items-start mb-6 ${isDone ? 'mt-4' : ''}`}>
                                    <div>
                                        <h3 className="font-heading font-bold text-xl text-white mb-1">{meta.nome}</h3>
                                        <p className="text-sm text-foreground/60">
                                            Prazo: <span className="text-white">{meta.prazo_meses} meses</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEdit(meta)} className="p-2 bg-surface hover:bg-white/10 rounded-lg"><Edit2 className="w-4 h-4 text-foreground/60 hover:text-white" /></button>
                                        <button onClick={() => handleDelete(meta.id)} className="p-2 bg-brand-red/10 hover:bg-brand-red/20 rounded-lg"><Trash2 className="w-4 h-4 text-brand-red" /></button>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-brand-purple font-bold">R$ {meta.valor_atual.toFixed(2)}</span>
                                        <span className="text-foreground/60">de R$ {meta.valor_total.toFixed(2)}</span>
                                    </div>
                                    <div className="w-full bg-background rounded-full h-3 border border-borders overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${isDone ? 'bg-brand-green' : 'bg-brand-purple line-glow'}`}
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-right text-xs text-foreground/50">{progress.toFixed(1)}% completo</div>
                                </div>

                                {!isDone && (
                                    <div className="bg-background rounded-xl p-4 border border-borders flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-foreground/50 uppercase font-bold tracking-wider mb-1">Para alcançar no prazo:</p>
                                                <p className="font-heading font-bold text-brand-blue">
                                                    Economizar <span className="text-white text-lg">R$ {perMonth.toFixed(2)}</span> /mês
                                                </p>
                                            </div>
                                            {addingValueId !== meta.id && (
                                                <button
                                                    onClick={() => setAddingValueId(meta.id)}
                                                    className="px-3 py-1.5 bg-brand-green/10 text-brand-green hover:bg-brand-green/20 rounded-lg flex items-center justify-center gap-1 text-sm font-bold transition-colors"
                                                    title="Adicionar valor guardado"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Adicionar
                                                </button>
                                            )}
                                        </div>

                                        {addingValueId === meta.id && (
                                            <div className="flex items-center gap-2 mt-2 pt-3 border-t border-borders animate-in fade-in zoom-in duration-200">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={valorAdicional}
                                                    onChange={e => setValorAdicional(e.target.value)}
                                                    placeholder="Valor (R$)"
                                                    className="flex-1 bg-surface border border-borders rounded-lg px-3 py-2 text-sm text-white focus:border-brand-green transition-colors outline-none"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleAddValue(meta.id, meta.valor_atual)}
                                                    className="p-2 bg-brand-green text-background hover:bg-brand-green/90 rounded-lg flex items-center justify-center font-bold"
                                                    title="Confirmar"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setAddingValueId(null);
                                                        setValorAdicional("");
                                                    }}
                                                    className="p-2 bg-brand-red/10 text-brand-red hover:bg-brand-red/20 rounded-lg flex items-center justify-center"
                                                    title="Cancelar"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* simple style for gradient bar */}
            <style jsx>{`
                .line-glow {
                    box-shadow: 0 0 10px 2px rgba(181, 123, 255, 0.4);
                }
            `}</style>
        </div>
    );
}
