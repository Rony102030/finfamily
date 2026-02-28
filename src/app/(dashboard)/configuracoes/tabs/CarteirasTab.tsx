"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { Plus, Edit2, Check, X, Trash2 } from "lucide-react";

interface Item {
    id: string;
    nome: string;
    tipo: string;
    ativo: boolean;
}

export function CarteirasTab() {
    const { user } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);

    // States for new item
    const [isAdding, setIsAdding] = useState(false);
    const [newNome, setNewNome] = useState("");
    const [newTipo, setNewTipo] = useState("Banco Digital");

    // States for editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editNome, setEditNome] = useState("");
    const [editTipo, setEditTipo] = useState("");

    const tipos = ["Banco Digital", "Corretora", "Espécie", "Outro"];

    useEffect(() => {
        if (user) fetchItems();
    }, [user]);

    const fetchItems = async () => {
        setLoading(true);
        const { data } = await supabase.from('carteiras').select('*').eq('user_id', user!.id).order('created_at', { ascending: true });
        if (data) setItems(data);
        setLoading(false);
    };

    const handleAdd = async () => {
        if (!newNome.trim()) return;
        const { data, error } = await supabase.from('carteiras').insert({
            user_id: user!.id,
            nome: newNome,
            tipo: newTipo,
            ativo: true
        }).select().single();

        if (data) {
            setItems([...items, data]);
            setNewNome("");
            setIsAdding(false);
        }
    };

    const handleToggleActive = async (id: string, current: boolean) => {
        const { error } = await supabase.from('carteiras').update({ ativo: !current }).eq('id', id);
        if (!error) {
            setItems(items.map(i => i.id === id ? { ...i, ativo: !current } : i));
        }
    };

    const startEdit = (item: Item) => {
        setEditingId(item.id);
        setEditNome(item.nome);
        setEditTipo(item.tipo);
    };

    const saveEdit = async (id: string) => {
        const { error } = await supabase.from('carteiras').update({ nome: editNome, tipo: editTipo }).eq('id', id);
        if (!error) {
            setItems(items.map(i => i.id === id ? { ...i, nome: editNome, tipo: editTipo } : i));
            setEditingId(null);
        }
    };

    if (loading) return <div className="animate-pulse h-20 bg-surface rounded"></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-heading font-bold text-white mb-1">Crie e gerencie contas bancárias ou carteiras de dinheiro.</h2>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 bg-brand-green text-[#0f131a] px-4 py-2 rounded-lg font-bold text-sm hover:bg-brand-green/90 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Nova Carteira
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {isAdding && (
                    <div className="flex flex-col md:flex-row gap-3 p-4 bg-surface border border-brand-green rounded-xl items-center">
                        <input
                            autoFocus
                            placeholder="Nome da carteira..."
                            value={newNome}
                            onChange={(e) => setNewNome(e.target.value)}
                            className="flex-1 bg-background border border-borders rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                        />
                        <select
                            value={newTipo}
                            onChange={(e) => setNewTipo(e.target.value)}
                            className="bg-background border border-borders rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                        >
                            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
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
                                    value={editNome}
                                    onChange={(e) => setEditNome(e.target.value)}
                                    className="flex-1 bg-background border border-borders rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                                />
                                <select
                                    value={editTipo}
                                    onChange={(e) => setEditTipo(e.target.value)}
                                    className="bg-background border border-borders rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                                >
                                    {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <div className="flex gap-2">
                                    <button onClick={() => saveEdit(item.id)} className="p-2 bg-brand-green rounded-lg text-[#0f131a]"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingId(null)} className="p-2 bg-surface border border-borders rounded-lg"><X className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-4 flex-1 w-full">
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.ativo ? 'bg-brand-green shadow-[0_0_8px_rgba(0,229,160,0.5)]' : 'bg-foreground/20'}`}></div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-white">{item.nome}</p>
                                        <p className="text-xs text-foreground/50">{item.tipo}</p>
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
                        <p className="text-foreground/50">Nenhuma carteira configurada.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
