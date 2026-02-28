"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { Plus, Edit2, Check, X } from "lucide-react";

interface Item {
    id: string;
    nome: string;
    icone: string;
    cor: string;
    limite_mensal: number | null;
    ativo: boolean;
}

export function CategoriasTab() {
    const { user } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);

    // States for new item
    const [isAdding, setIsAdding] = useState(false);
    const [newNome, setNewNome] = useState("");
    const [newIcone, setNewIcone] = useState("🏷️");
    const [newCor, setNewCor] = useState("#4d9fff");

    // States for editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editNome, setEditNome] = useState("");
    const [editIcone, setEditIcone] = useState("");
    const [editCor, setEditCor] = useState("");
    const [editLimite, setEditLimite] = useState<string>("");

    useEffect(() => {
        if (user) fetchItems();
    }, [user]);

    const fetchItems = async () => {
        setLoading(true);
        const { data } = await supabase.from('categorias').select('*').eq('user_id', user!.id).order('created_at', { ascending: true });
        if (data) setItems(data);
        setLoading(false);
    };

    const handleAdd = async () => {
        if (!newNome.trim()) return;
        const { data, error } = await supabase.from('categorias').insert({
            user_id: user!.id,
            nome: newNome,
            icone: newIcone,
            cor: newCor,
            ativo: true
        }).select().single();

        if (data) {
            setItems([...items, data]);
            setNewNome("");
            setNewIcone("🏷️");
            setIsAdding(false);
        }
    };

    const handleToggleActive = async (id: string, current: boolean) => {
        const { error } = await supabase.from('categorias').update({ ativo: !current }).eq('id', id);
        if (!error) {
            setItems(items.map(i => i.id === id ? { ...i, ativo: !current } : i));
        }
    };

    const startEdit = (item: Item) => {
        setEditingId(item.id);
        setEditNome(item.nome);
        setEditIcone(item.icone || "🏷️");
        setEditCor(item.cor || "#ffffff");
        setEditLimite(item.limite_mensal ? item.limite_mensal.toString() : "");
    };

    const saveEdit = async (id: string) => {
        const lim = parseFloat(editLimite);
        const updates = {
            nome: editNome,
            icone: editIcone,
            cor: editCor,
            limite_mensal: isNaN(lim) ? null : lim
        };
        const { error } = await supabase.from('categorias').update(updates).eq('id', id);
        if (!error) {
            setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
            setEditingId(null);
        }
    };

    if (loading) return <div className="animate-pulse h-20 bg-surface rounded"></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-heading font-bold text-white mb-1">Categorias de Despesas</h2>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 bg-brand-green text-[#0f131a] px-4 py-2 rounded-lg font-bold text-sm hover:bg-brand-green/90 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Nova Categoria
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {isAdding && (
                    <div className="flex flex-col md:flex-row gap-3 p-4 bg-surface border border-brand-green rounded-xl items-center">
                        <input
                            placeholder="Emoji"
                            value={newIcone}
                            maxLength={2}
                            onChange={(e) => setNewIcone(e.target.value)}
                            className="w-16 bg-background border border-borders rounded-lg px-2 py-2 text-center text-xl focus:outline-none focus:border-brand-green"
                        />
                        <input
                            type="color"
                            value={newCor}
                            onChange={(e) => setNewCor(e.target.value)}
                            className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <input
                            autoFocus
                            placeholder="Nome da categoria..."
                            value={newNome}
                            onChange={(e) => setNewNome(e.target.value)}
                            className="flex-1 bg-background border border-borders rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                        />

                        <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                            <button onClick={handleAdd} className="flex-1 md:flex-none flex items-center justify-center gap-1 bg-brand-green text-[#0f131a] px-4 py-2 rounded-lg font-bold text-sm"><Check className="w-4 h-4" /> Salvar</button>
                            <button onClick={() => setIsAdding(false)} className="flex-1 md:flex-none flex items-center justify-center gap-1 bg-surface text-foreground/70 px-4 py-2 rounded-lg font-bold text-sm border border-borders hover:text-white"><X className="w-4 h-4" /> Cancelar</button>
                        </div>
                    </div>
                )}

                {items.map(item => (
                    <div key={item.id} className={`flex flex-col md:flex-row gap-4 p-4 rounded-xl border items-center justify-between transition-colors ${item.ativo ? 'bg-surface border-borders' : 'bg-surface/50 border-borders/50 opacity-60'}`}>
                        {editingId === item.id ? (
                            <div className="flex flex-col md:flex-row gap-3 w-full items-center">
                                <input
                                    value={editIcone}
                                    maxLength={2}
                                    onChange={(e) => setEditIcone(e.target.value)}
                                    className="w-16 bg-background border border-borders rounded-lg px-2 py-2 text-center text-xl focus:outline-none focus:border-brand-green"
                                />
                                <input
                                    type="color"
                                    value={editCor}
                                    onChange={(e) => setEditCor(e.target.value)}
                                    className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                                />
                                <input
                                    value={editNome}
                                    onChange={(e) => setEditNome(e.target.value)}
                                    className="flex-1 bg-background border border-borders rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                                />
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-foreground/70">Limite Mensal R$</span>
                                    <input
                                        type="number"
                                        placeholder="Sem limite"
                                        value={editLimite}
                                        onChange={(e) => setEditLimite(e.target.value)}
                                        className="w-32 bg-background border border-borders rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                                    />
                                </div>
                                <div className="flex gap-2 min-w-max">
                                    <button onClick={() => saveEdit(item.id)} className="p-2 bg-brand-green rounded-lg text-[#0f131a]"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingId(null)} className="p-2 bg-surface border border-borders rounded-lg"><X className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-4 flex-1 w-full">
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${!item.ativo && 'opacity-50'}`}
                                        style={{ backgroundColor: `${item.cor}20`, border: `1px solid ${item.cor}40` }}
                                    >
                                        {item.icone}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-white" style={{ color: item.ativo ? item.cor : undefined }}>{item.nome}</p>
                                        {item.limite_mensal && (
                                            <p className="text-xs text-foreground/50 mt-1">Limite: R$ {item.limite_mensal.toFixed(2)}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => startEdit(item)}
                                        className="p-2 text-foreground/50 hover:text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleToggleActive(item.id, item.ativo)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${item.ativo ? 'bg-brand-red/10 text-brand-red hover:bg-brand-red/20' : 'bg-brand-green/10 text-brand-green hover:bg-brand-green/20'}`}
                                    >
                                        {item.ativo ? 'Desativar' : 'Ativar'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}

                {items.length === 0 && !isAdding && !loading && (
                    <div className="text-center py-12 border border-dashed border-borders rounded-2xl">
                        <p className="text-foreground/50">Nenhuma categoria configurada.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
