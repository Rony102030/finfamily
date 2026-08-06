"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import {
    Tag, Plus, Trash2, Edit2, Check, X, Zap, ToggleLeft, ToggleRight, TestTube
} from "lucide-react";

interface RegraClassificacao {
    id: string;
    padrao: string;
    tipo_transacao: string;
    categoria_id: string | null;
    subcategoria_id: string | null;
    fonte_renda_id: string | null;
    carteira_id: string | null;
    vezes_usada: number;
    ativo: boolean;
}

export default function ClassificacaoPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [regras, setRegras] = useState<RegraClassificacao[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [subcategorias, setSubcategorias] = useState<any[]>([]);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [padrao, setPadrao] = useState("");
    const [tipoTransacao, setTipoTransacao] = useState("despesa");
    const [categoriaId, setCategoriaId] = useState("");
    const [subcategoriaId, setSubcategoriaId] = useState("");

    const [testInput, setTestInput] = useState("");
    const [testResult, setTestResult] = useState<string | null>(null);

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        const [{ data: regrasData }, { data: catData }, { data: subData }] = await Promise.all([
            supabase.from('regras_classificacao').select('*').eq('user_id', user!.id).order('vezes_usada', { ascending: false }),
            supabase.from('categorias').select('*').eq('user_id', user!.id),
            supabase.from('subcategorias').select('*').eq('user_id', user!.id),
        ]);

        if (regrasData) setRegras(regrasData);
        if (catData) setCategorias(catData);
        if (subData) setSubcategorias(subData);
        setLoading(false);
    };

    const resetForm = () => {
        setEditingId(null);
        setShowForm(false);
        setPadrao("");
        setTipoTransacao("despesa");
        setCategoriaId("");
        setSubcategoriaId("");
    };

    const handleEdit = (regra: RegraClassificacao) => {
        setEditingId(regra.id);
        setPadrao(regra.padrao);
        setTipoTransacao(regra.tipo_transacao);
        setCategoriaId(regra.categoria_id || "");
        setSubcategoriaId(regra.subcategoria_id || "");
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !padrao || !tipoTransacao) return;
        setIsSubmitting(true);

        const payload = {
            padrao,
            tipo_transacao: tipoTransacao,
            categoria_id: categoriaId || null,
            subcategoria_id: subcategoriaId || null,
        };

        if (editingId) {
            const { error } = await supabase.from('regras_classificacao').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId).eq('user_id', user.id);
            if (!error) {
                setRegras(regras.map(r => r.id === editingId ? { ...r, ...payload } : r));
                resetForm();
            }
        } else {
            const { data: newRegra, error } = await supabase
                .from('regras_classificacao')
                .insert({ user_id: user.id, ...payload })
                .select()
                .single();

            if (!error && newRegra) {
                setRegras([newRegra, ...regras]);
                resetForm();
            }
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir esta regra?")) return;
        await supabase.from('regras_classificacao').delete().eq('id', id).eq('user_id', user!.id);
        setRegras(regras.filter(r => r.id !== id));
    };

    const handleToggle = async (regra: RegraClassificacao) => {
        const novoAtivo = !regra.ativo;
        await supabase.from('regras_classificacao').update({ ativo: novoAtivo }).eq('id', regra.id).eq('user_id', user!.id);
        setRegras(regras.map(r => r.id === regra.id ? { ...r, ativo: novoAtivo } : r));
    };

    const handleTest = async () => {
        if (!testInput) return;
        try {
            const res = await fetch('/api/classificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    descricao: testInput,
                    regras_usuario: regras.filter(r => r.ativo).map(r => ({
                        padrao: r.padrao,
                        tipo_transacao: r.tipo_transacao,
                        categoria_nome: categorias.find(c => c.id === r.categoria_id)?.nome || null,
                    })),
                }),
            });
            const result = await res.json();
            if (result.classificado) {
                setTestResult(`${result.tipo_transacao}${result.categoria_nome ? ` → ${result.categoria_nome}` : ''}${result.subcategoria_nome ? ` → ${result.subcategoria_nome}` : ''} (regra: ${result.regra_usada})`);
            } else {
                setTestResult('Nenhuma regra encontrada para esta descrição.');
            }
        } catch {
            setTestResult('Erro ao testar.');
        }
    };

    const catNome = (id: string | null) => categorias.find(c => c.id === id)?.nome || '—';
    const subNome = (id: string | null) => subcategorias.find(s => s.id === id)?.nome || '';

    if (loading) return <div className="p-8 text-foreground/50 animate-pulse">Carregando regras...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="pb-6 border-b border-borders flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
                        <Tag className="text-purple-400 w-6 h-6" /> Classificação Automática
                    </h1>
                    <p className="text-foreground/60 mt-1">Regras regex para classificar transações bancárias automaticamente.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="bg-brand-blue hover:bg-brand-blue/90 text-background font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-transform active:scale-95"
                >
                    <Plus className="w-4 h-4" /> Nova Regra
                </button>
            </header>

            {/* Testador */}
            <div className="bg-cards border border-borders rounded-2xl p-5">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-3">
                    <TestTube className="w-4 h-4 text-purple-400" /> Testar Classificação
                </h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={testInput}
                        onChange={e => setTestInput(e.target.value)}
                        placeholder="Ex: PIX Enviado - SUPERMERCADO BOM PRECO"
                        className="flex-1 bg-surface border border-borders rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-400 transition-all text-sm"
                        onKeyDown={e => e.key === 'Enter' && handleTest()}
                    />
                    <button onClick={handleTest} className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1 transition-all">
                        <Zap className="w-4 h-4" /> Testar
                    </button>
                </div>
                {testResult && (
                    <div className="mt-2 text-sm px-4 py-2 bg-surface rounded-lg border border-borders">
                        <span className="text-foreground/60">Resultado:</span>{' '}
                        <span className="text-white font-medium">{testResult}</span>
                    </div>
                )}
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
                    <div className="bg-cards border border-borders rounded-2xl p-6 w-full max-w-md space-y-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-heading font-bold text-white text-lg">{editingId ? 'Editar Regra' : 'Nova Regra'}</h3>
                            <button onClick={resetForm} className="text-foreground/50 hover:text-white p-1"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-foreground/70 mb-1">Padrão (regex)</label>
                                <input type="text" required value={padrao} onChange={e => setPadrao(e.target.value)} placeholder="netflix|spotify|disney" className="w-full bg-surface border border-borders rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-400 transition-all font-mono text-sm" />
                                <p className="text-[10px] text-foreground/40 mt-1">Use | para separar variações. Ex: uber|99|cabify</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground/70 mb-1">Tipo de Transação</label>
                                <select value={tipoTransacao} onChange={e => setTipoTransacao(e.target.value)} className="w-full bg-surface border border-borders rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-400 transition-all text-sm">
                                    <option value="despesa">Despesa</option>
                                    <option value="renda">Renda</option>
                                    <option value="emprestimo">Empréstimo</option>
                                    <option value="investimento_negocio">Investimento/Negócio</option>
                                    <option value="devolucao">Devolução</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground/70 mb-1">Categoria</label>
                                <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className="w-full bg-surface border border-borders rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-400 transition-all text-sm">
                                    <option value="">Nenhuma</option>
                                    {categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                                </select>
                            </div>
                            {categoriaId && (
                                <div>
                                    <label className="block text-xs font-medium text-foreground/70 mb-1">Subcategoria</label>
                                    <select value={subcategoriaId} onChange={e => setSubcategoriaId(e.target.value)} className="w-full bg-surface border border-borders rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-400 transition-all text-sm">
                                        <option value="">Nenhuma</option>
                                        {subcategorias.filter(s => s.categoria_id === categoriaId).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                    </select>
                                </div>
                            )}
                            <button type="submit" disabled={isSubmitting} className="w-full bg-purple-500 hover:bg-purple-500/90 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50">
                                {isSubmitting ? 'Salvando...' : <>{editingId ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />} {editingId ? 'Atualizar' : 'Criar Regra'}</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Lista de regras */}
            {regras.length === 0 ? (
                <div className="text-center py-12 bg-cards rounded-2xl border border-dashed border-borders">
                    <Tag className="w-10 h-10 text-foreground/30 mx-auto mb-3" />
                    <p className="text-foreground/50 font-medium">Nenhuma regra criada</p>
                    <p className="text-sm text-foreground/40 mt-1">Crie regras para classificar transações automaticamente.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {regras.map(regra => (
                        <div key={regra.id} className={`bg-cards border border-borders rounded-xl p-4 flex items-center justify-between gap-4 ${!regra.ativo ? 'opacity-40' : ''}`}>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <button onClick={() => handleToggle(regra)} className="flex-shrink-0" title={regra.ativo ? 'Desativar' : 'Ativar'}>
                                    {regra.ativo
                                        ? <ToggleRight className="w-6 h-6 text-brand-green" />
                                        : <ToggleLeft className="w-6 h-6 text-foreground/30" />
                                    }
                                </button>
                                <div className="min-w-0">
                                    <p className="text-white font-mono text-sm truncate">{regra.padrao}</p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded font-bold">{regra.tipo_transacao}</span>
                                        {regra.categoria_id && <span className="text-[10px] text-foreground/40">{catNome(regra.categoria_id)}</span>}
                                        {regra.subcategoria_id && <span className="text-[10px] text-foreground/40">→ {subNome(regra.subcategoria_id)}</span>}
                                        <span className="text-[10px] text-foreground/30">{regra.vezes_usada}x usada</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => handleEdit(regra)} className="p-2 text-foreground/40 hover:text-brand-blue rounded-lg hover:bg-white/5 transition-all"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(regra.id)} className="p-2 text-foreground/40 hover:text-brand-red rounded-lg hover:bg-white/5 transition-all"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
