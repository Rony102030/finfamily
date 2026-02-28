"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthProvider";
import { X, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useAppStore } from "@/store";

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function TransactionModal({ isOpen, onClose, onSuccess }: TransactionModalProps) {
    const { user } = useAuth();
    const { userConfig } = useAppStore();

    const [type, setType] = useState<'despesa' | 'renda'>('despesa');
    const [saving, setSaving] = useState(false);

    // Base fields
    const [descricao, setDescricao] = useState("");
    const [valor, setValor] = useState("");
    const [dataStr, setDataStr] = useState(new Date().toISOString().split('T')[0]);
    const [carteiraId, setCarteiraId] = useState("");

    // Support data
    const [carteiras, setCarteiras] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [subcategorias, setSubcategorias] = useState<any[]>([]); // To do: load filtered
    const [fontes, setFontes] = useState<any[]>([]);

    // Despesa fields
    const [categoriaId, setCategoriaId] = useState("");
    const [subcategoriaId, setSubcategoriaId] = useState("");
    const [status, setStatus] = useState<'pago' | 'pendente'>('pago');
    const [recorrente, setRecorrente] = useState(false);

    // Renda fields
    const [fonteId, setFonteId] = useState("");

    useEffect(() => {
        if (isOpen && user) {
            loadSupportData();
        } else {
            resetForm();
        }
    }, [isOpen, user]);

    const loadSupportData = async () => {
        // Run unawaited to speed up
        supabase.from('carteiras').select('*').eq('user_id', user!.id).eq('ativo', true).then(({ data }) => {
            setCarteiras(data || []);
            if (data && data.length > 0) setCarteiraId(data[0].id);
        });
        supabase.from('categorias').select('*').eq('user_id', user!.id).eq('ativo', true).then(({ data }) => {
            setCategorias(data || []);
            if (data && data.length > 0) setCategoriaId(data[0].id);
        });
        supabase.from('subcategorias').select('*').eq('user_id', user!.id).then(({ data }) => {
            setSubcategorias(data || []);
        });
        supabase.from('fontes_renda').select('*').eq('user_id', user!.id).eq('ativo', true).then(({ data }) => {
            setFontes(data || []);
            if (data && data.length > 0) setFonteId(data[0].id);
        });
    };

    const resetForm = () => {
        setDescricao("");
        setValor("");
        setStatus("pago");
        setRecorrente(false);
        setSubcategoriaId("");
    };

    useEffect(() => {
        setSubcategoriaId("");
    }, [categoriaId]);

    const filteredSubcategorias = subcategorias.filter(s => s.categoria_id === categoriaId);

    // Previews for Renda
    const numVal = parseFloat(valor.replace(',', '.')) || 0;
    let valFixo = 0, valEmergencia = 0, valOutro = 0, rendaLiquida = numVal;

    if (type === 'renda' && userConfig) {
        valFixo = (numVal * userConfig.pct_fixo) / 100;
        valEmergencia = (numVal * userConfig.pct_emergencia) / 100;
        valOutro = (numVal * userConfig.pct_outro) / 100;
        rendaLiquida = numVal - valFixo - valEmergencia - valOutro;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);

        // Extract mes from dataStr
        const mes = dataStr.substring(0, 7); // YYYY-MM

        try {
            const payload = {
                user_id: user.id,
                mes,
                tipo: type,
                descricao,
                valor: numVal,
                data: dataStr,
                carteira_id: carteiraId || null,
                status,
                recorrente: type === 'despesa' ? recorrente : false,
                categoria_id: type === 'despesa' ? (categoriaId || null) : null,
                subcategoria_id: type === 'despesa' ? (subcategoriaId || null) : null,
                fonte_renda_id: type === 'renda' ? (fonteId || null) : null
            };

            const { data: lancamento, error } = await supabase.from('lancamentos').insert(payload).select().single();
            if (error) throw error;

            // If Income, distribute to funds
            if (type === 'renda' && userConfig) {
                // Register contributions
                await supabase.from('contribuicoes').insert({
                    user_id: user.id,
                    mes,
                    fixo_valor: valFixo,
                    emergencia_valor: valEmergencia,
                    outro_valor: valOutro,
                    lancamento_id: lancamento.id
                });

                // Update fundos
                // using an RPC would be ideal for concurrency, but we can read/write for now
                const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user.id).single();
                if (f) {
                    await supabase.from('fundos').update({
                        fixo_saldo: parseFloat(f.fixo_saldo) + valFixo,
                        emergencia_saldo: parseFloat(f.emergencia_saldo) + valEmergencia,
                        outro_saldo: parseFloat(f.outro_saldo) + valOutro,
                    }).eq('id', f.id);
                }
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            alert("Erro ao salvar lançamento.");
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-cards border border-borders rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-borders">
                    <h2 className="text-xl font-heading font-bold text-white">Novo Lançamento</h2>
                    <button onClick={onClose} className="p-2 text-foreground/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {/* Type Toggle */}
                    <div className="flex bg-surface rounded-xl p-1 mb-6 border border-borders relative">
                        <button
                            onClick={() => setType('despesa')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${type === 'despesa' ? 'bg-brand-red text-white shadow-md' : 'text-foreground/60 hover:text-white'}`}
                        >
                            <ArrowDownCircle className="w-4 h-4" /> Despesa
                        </button>
                        <button
                            onClick={() => setType('renda')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${type === 'renda' ? 'bg-brand-green text-[#0f131a] shadow-md' : 'text-foreground/60 hover:text-white'}`}
                        >
                            <ArrowUpCircle className="w-4 h-4" /> Renda
                        </button>
                    </div>

                    <form id="tx-form" onSubmit={handleSubmit} className="space-y-4">
                        {/* Common Fields */}
                        <div>
                            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Descrição</label>
                            <input required value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Mercado, Salário" autoFocus className="w-full bg-background border border-borders rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-blue" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Valor (R$)</label>
                                <input required type="number" step="0.01" min="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className="w-full bg-background border border-borders rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-blue" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Data</label>
                                <input required type="date" value={dataStr} onChange={e => setDataStr(e.target.value)} className="w-full bg-background border border-borders rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-blue" />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Carteira / Conta</label>
                            <select required value={carteiraId} onChange={e => setCarteiraId(e.target.value)} className="w-full bg-surface border border-borders rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-blue [&>option]:bg-surface [&>option]:text-white">
                                {carteiras.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>

                        {/* Despesa Specific */}
                        {type === 'despesa' && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Categoria</label>
                                        <select required value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className="w-full bg-surface border border-borders rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-blue [&>option]:bg-surface [&>option]:text-white">
                                            {categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                                        </select>
                                    </div>
                                    {filteredSubcategorias.length > 0 && (
                                        <div>
                                            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Subcategoria</label>
                                            <select value={subcategoriaId} onChange={e => setSubcategoriaId(e.target.value)} className="w-full bg-surface border border-borders rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-blue [&>option]:bg-surface [&>option]:text-white">
                                                <option value="">Selecione (Opcional)</option>
                                                {filteredSubcategorias.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-6 mt-4 pt-4 border-t border-borders">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={status === 'pago'} onChange={e => setStatus(e.target.checked ? 'pago' : 'pendente')} className="accent-brand-green w-4 h-4" />
                                        <span className="text-sm text-foreground/90">Já foi pago?</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} className="accent-brand-green w-4 h-4" />
                                        <span className="text-sm text-foreground/90">Repete todo mês</span>
                                    </label>
                                </div>
                            </>
                        )}

                        {/* Renda Specific */}
                        {type === 'renda' && (
                            <>
                                <div>
                                    <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Fonte de Renda</label>
                                    <select required value={fonteId} onChange={e => setFonteId(e.target.value)} className="w-full bg-surface border border-borders rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-blue [&>option]:bg-surface [&>option]:text-white">
                                        {fontes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                    </select>
                                </div>

                                {numVal > 0 && userConfig && (
                                    <div className="mt-4 p-4 border border-brand-green/30 bg-brand-green/5 rounded-xl space-y-3">
                                        <div className="flex items-center gap-2 text-brand-green text-sm font-bold">
                                            ⚡ Desconto automático para Fundos
                                        </div>
                                        <div className="space-y-1 text-sm text-foreground/80">
                                            {userConfig.pct_fixo > 0 && (
                                                <div className="flex justify-between"><span>Renda Fixa ({userConfig.pct_fixo}%):</span> <span>- R$ {valFixo.toFixed(2)}</span></div>
                                            )}
                                            {userConfig.pct_emergencia > 0 && (
                                                <div className="flex justify-between"><span>Emergência ({userConfig.pct_emergencia}%):</span> <span>- R$ {valEmergencia.toFixed(2)}</span></div>
                                            )}
                                            {userConfig.pct_outro > 0 && (
                                                <div className="flex justify-between"><span>{userConfig.outro_nome || `3º Fundo`} ({userConfig.pct_outro}%):</span> <span>- R$ {valOutro.toFixed(2)}</span></div>
                                            )}
                                            <div className="pt-2 mt-2 border-t border-white/10 flex justify-between font-bold text-white">
                                                <span>Renda Líquida na Carteira:</span>
                                                <span className="text-brand-green">R$ {rendaLiquida.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </form>
                </div>

                <div className="p-6 border-t border-borders bg-surface/50">
                    <button
                        form="tx-form"
                        type="submit"
                        disabled={saving}
                        className={`w-full py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all ${type === 'despesa' ? 'bg-brand-red text-white hover:bg-brand-red/90' : 'bg-brand-green text-[#0f131a] hover:bg-brand-green/90'} disabled:opacity-50`}
                    >
                        {saving ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : 'Salvar Lançamento'}
                    </button>
                </div>
            </div>
        </div>
    );
}
