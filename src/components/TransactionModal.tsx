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
    transactionToEdit?: any;
    tipoInicial?: 'despesa' | 'renda';
}

export function TransactionModal({ isOpen, onClose, onSuccess, transactionToEdit, tipoInicial }: TransactionModalProps) {
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

    // Installments / Repetition
    const [tipoRepeticao, setTipoRepeticao] = useState<'unica' | 'parcelada' | 'fixa'>('unica');
    const [quantidadeParcelas, setQuantidadeParcelas] = useState(2);

    // Renda fields
    const [fonteId, setFonteId] = useState("");

    useEffect(() => {
        if (isOpen && user) {
            loadSupportData().then(() => {
                if (transactionToEdit) {
                    setType(transactionToEdit.tipo);
                    setDescricao(transactionToEdit.descricao);
                    setValor(transactionToEdit.valor.toString());
                    setDataStr(transactionToEdit.data);
                    if (transactionToEdit.carteira_id) setCarteiraId(transactionToEdit.carteira_id);
                    if (transactionToEdit.status) setStatus(transactionToEdit.status);

                    if (transactionToEdit.tipo === 'despesa') {
                        if (transactionToEdit.categoria_id) setCategoriaId(transactionToEdit.categoria_id);
                        if (transactionToEdit.subcategoria_id) setSubcategoriaId(transactionToEdit.subcategoria_id);
                        setRecorrente(transactionToEdit.recorrente);
                        if (transactionToEdit.parcela_total) {
                            setTipoRepeticao('parcelada');
                            setQuantidadeParcelas(transactionToEdit.parcela_total);
                        } else if (transactionToEdit.recorrente) {
                            setTipoRepeticao('fixa');
                        } else {
                            setTipoRepeticao('unica');
                        }
                    } else if (transactionToEdit.tipo === 'renda') {
                        if (transactionToEdit.fonte_renda_id) setFonteId(transactionToEdit.fonte_renda_id);
                    }
                } else {
                    resetForm();
                    if (tipoInicial) setType(tipoInicial);
                }
            });
        }
    }, [isOpen, user, transactionToEdit, tipoInicial]);

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
        setTipoRepeticao('unica');
        setQuantidadeParcelas(2);
        setSubcategoriaId("");
        setDataStr(new Date().toISOString().split('T')[0]);
        setType('despesa');
    };

    useEffect(() => {
        setSubcategoriaId("");
    }, [categoriaId]);

    const filteredSubcategorias = subcategorias.filter(s => s.categoria_id === categoriaId);

    // No more automatic previews for Renda
    const numVal = parseFloat(valor.replace(',', '.')) || 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);

        const mesStr = dataStr.substring(0, 7); // YYYY-MM
        const [year, month, day] = dataStr.split('-');

        let fundDiff = 0;
        const isNowEmergencia = type === 'despesa' && (() => { const nome = categorias.find(c => c.id === categoriaId)?.nome || ''; return nome.toLowerCase().includes('emergên') || nome.toLowerCase().includes('emergencia'); })();

        if (transactionToEdit) {
            const wasEmergencia = transactionToEdit.tipo === 'despesa' && (() => { const nome = transactionToEdit.categorias?.nome || ''; return nome.toLowerCase().includes('emergên') || nome.toLowerCase().includes('emergencia'); })();
            const oldVal = parseFloat(transactionToEdit.valor) || 0;
            if (wasEmergencia && isNowEmergencia) {
                fundDiff = oldVal - numVal;
            } else if (wasEmergencia && !isNowEmergencia) {
                fundDiff = oldVal;
            } else if (!wasEmergencia && isNowEmergencia) {
                fundDiff = -numVal;
            }
        } else {
            if (isNowEmergencia) {
                const repeatCount = (type === 'despesa' && tipoRepeticao === 'parcelada') ? quantidadeParcelas : 1;
                fundDiff = -(numVal * repeatCount);
            }
        }

        try {
            if (transactionToEdit) {
                // UPDATE flow
                if (transactionToEdit.group_id) {
                    // Atualiza todas as parcelas do grupo
                    const { data: groupItems, error: fetchErr } = await supabase
                        .from('lancamentos')
                        .select('*')
                        .eq('group_id', transactionToEdit.group_id);

                    if (fetchErr) throw fetchErr;

                    if (groupItems && groupItems.length > 0) {
                        const updates = groupItems.map(item => {
                            const [newYear, newMonth, newDay] = dataStr.split('-');
                            const [oldYear, oldMonth] = item.data.split('-');

                            let dDate = new Date(parseInt(oldYear), parseInt(oldMonth) - 1, 1);
                            const maxDaysInMonth = new Date(dDate.getFullYear(), dDate.getMonth() + 1, 0).getDate();
                            const finalDay = Math.min(parseInt(newDay), maxDaysInMonth).toString().padStart(2, '0');

                            const newDataStr = `${oldYear}-${oldMonth}-${finalDay}`;

                            return {
                                ...item,
                                tipo: type,
                                descricao,
                                valor: numVal,
                                data: newDataStr,
                                carteira_id: carteiraId || null,
                                status: item.id === transactionToEdit.id ? status : item.status,
                                recorrente: type === 'despesa' ? (tipoRepeticao === 'fixa') : false,
                                categoria_id: type === 'despesa' ? (categoriaId || null) : null,
                                subcategoria_id: type === 'despesa' ? (subcategoriaId || null) : null,
                                fonte_renda_id: type === 'renda' ? (fonteId || null) : null
                            };
                        });

                        const { error: upsertErr } = await supabase.from('lancamentos').upsert(updates);
                        if (upsertErr) throw upsertErr;
                    }
                } else {
                    const payload = {
                        tipo: type,
                        descricao,
                        valor: numVal,
                        data: dataStr,
                        mes: mesStr,
                        carteira_id: carteiraId || null,
                        status,
                        recorrente: type === 'despesa' ? (tipoRepeticao === 'fixa') : false,
                        categoria_id: type === 'despesa' ? (categoriaId || null) : null,
                        subcategoria_id: type === 'despesa' ? (subcategoriaId || null) : null,
                        fonte_renda_id: type === 'renda' ? (fonteId || null) : null
                    };
                    const { error } = await supabase.from('lancamentos').update(payload).eq('id', transactionToEdit.id);
                    if (error) throw error;
                }
            } else {
                // INSERT flow
                const isParcelado = type === 'despesa' && tipoRepeticao === 'parcelada';
                const isFixa = type === 'despesa' && tipoRepeticao === 'fixa';
                const repeatCount = isParcelado ? quantidadeParcelas : 1;

                // Gera group_id se for parcelado ou fixo (para possibilitar atualização em lote depois se for parcelado)
                const groupId = isParcelado ? crypto.randomUUID() : null;

                const basePayload = {
                    user_id: user.id,
                    tipo: type,
                    descricao,
                    group_id: groupId,
                    valor: numVal,
                    carteira_id: carteiraId || null,
                    status,
                    recorrente: isFixa,
                    categoria_id: type === 'despesa' ? (categoriaId || null) : null,
                    subcategoria_id: type === 'despesa' ? (subcategoriaId || null) : null,
                    fonte_renda_id: type === 'renda' ? (fonteId || null) : null
                };

                let payloads = [];
                for (let i = 0; i < repeatCount; i++) {
                    const targetYear = parseInt(year);
                    const targetMonthIndex = parseInt(month) - 1 + i;

                    let dDate = new Date(targetYear, targetMonthIndex, 1);
                    const maxDaysInMonth = new Date(dDate.getFullYear(), dDate.getMonth() + 1, 0).getDate();

                    const finalDay = Math.min(parseInt(day), maxDaysInMonth);
                    dDate = new Date(targetYear, targetMonthIndex, finalDay);

                    const dY = dDate.getFullYear();
                    const dM = (dDate.getMonth() + 1).toString().padStart(2, '0');
                    const dD = dDate.getDate().toString().padStart(2, '0');
                    const currentMes = `${dY}-${dM}`;
                    const currentData = `${dY}-${dM}-${dD}`;

                    payloads.push({
                        ...basePayload,
                        mes: currentMes,
                        data: currentData,
                        status: i === 0 ? status : 'pendente',
                        parcela_atual: isParcelado ? i + 1 : null,
                        parcela_total: isParcelado ? quantidadeParcelas : null,
                        descricao: descricao,
                    });
                }

                const { error } = await supabase.from('lancamentos').insert(payloads);
                if (error) throw error;
            }

            if (fundDiff !== 0) {
                const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user.id).single();
                if (f) {
                    await supabase.from('fundos').update({
                        emergencia_saldo: Math.max(0, parseFloat(f.emergencia_saldo || "0") + fundDiff)
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-cards border border-borders rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-borders">
                    <h2 className="text-xl font-heading font-bold text-white">
                        {transactionToEdit ? 'Editar Lançamento' : 'Novo Lançamento'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-foreground/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar">
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

                                <div className="border border-borders rounded-xl p-4 mt-4 bg-surface/30">
                                    <label className="text-sm font-medium text-foreground/80 mb-3 block">Repetição</label>
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <button type="button" onClick={() => setTipoRepeticao('unica')} className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors border ${tipoRepeticao === 'unica' ? 'bg-brand-blue/20 border-brand-blue text-white' : 'border-borders text-foreground/60 hover:text-white hover:bg-white/5'}`}>
                                            Única
                                        </button>
                                        <button type="button" onClick={() => setTipoRepeticao('parcelada')} disabled={!!transactionToEdit} className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors border ${tipoRepeticao === 'parcelada' ? 'bg-brand-blue/20 border-brand-blue text-white' : 'border-borders text-foreground/60 hover:text-white hover:bg-white/5'} disabled:opacity-50 disabled:cursor-not-allowed`} title={transactionToEdit ? "Não é possível parcelar numa edição" : ""}>
                                            Parcelada
                                        </button>
                                        <button type="button" onClick={() => setTipoRepeticao('fixa')} className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors border ${tipoRepeticao === 'fixa' ? 'bg-brand-blue/20 border-brand-blue text-white' : 'border-borders text-foreground/60 hover:text-white hover:bg-white/5'}`}>
                                            Fixa
                                        </button>
                                    </div>

                                    {tipoRepeticao === 'parcelada' && !transactionToEdit && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Quantidade de Parcelas</label>
                                            <input type="number" min="2" max="360" value={quantidadeParcelas} onChange={e => setQuantidadeParcelas(parseInt(e.target.value) || 2)} className="w-full bg-background border border-borders rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-blue" />
                                            <p className="text-xs text-foreground/50 mt-2">
                                                Dica: o sistema irá lançar os meses seguintes automaticamente com o status pendente. O valor informado deve ser o da parcela.
                                            </p>
                                        </div>
                                    )}
                                    {tipoRepeticao === 'fixa' && (
                                        <p className="text-xs text-foreground/50 animate-in fade-in slide-in-from-top-2 duration-300">
                                            Essa despesa será listada na aba &quot;Contas Recorrentes&quot; para lançamento fácil nos próximos meses.
                                        </p>
                                    )}
                                </div>

                                <div className="flex mt-4 pt-4 border-t border-borders">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={status === 'pago'} onChange={e => setStatus(e.target.checked ? 'pago' : 'pendente')} className="accent-brand-green w-4 h-4" />
                                        <span className="text-sm text-foreground/90">A parcela atual já foi paga?</span>
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
                            </>
                        )}
                    </form>
                </div>

                <div className="p-4 sm:p-6 border-t border-borders bg-surface/50">
                    <button
                        form="tx-form"
                        type="submit"
                        disabled={saving}
                        className={`w-full py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all ${type === 'despesa' ? 'bg-brand-red text-white hover:bg-brand-red/90' : 'bg-brand-green text-[#0f131a] hover:bg-brand-green/90'} disabled:opacity-50`}
                    >
                        {saving ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : (transactionToEdit ? 'Atualizar Lançamento' : 'Salvar Lançamento')}
                    </button>
                </div>
            </div>
        </div>
    );
}
