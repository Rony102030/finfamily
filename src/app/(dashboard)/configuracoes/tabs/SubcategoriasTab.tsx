import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { Plus, Trash2, Tag, Loader2, FolderTree, Edit2, Check, X } from "lucide-react";

type Categoria = { id: string; nome: string };
type Subcategoria = { id: string; nome: string; categoria_id: string; categorias?: { nome: string } };

export function SubcategoriasTab() {
    const { user } = useAuth();
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [newNome, setNewNome] = useState("");
    const [selectedCategoria, setSelectedCategoria] = useState("");

    // States for editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editNome, setEditNome] = useState("");
    const [editCategoriaId, setEditCategoriaId] = useState("");

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        // Load Categorias
        const { data: catData } = await supabase
            .from('categorias')
            .select('*')
            .eq('user_id', user!.id)
            .order('nome', { ascending: true });

        if (catData) {
            setCategorias(catData);
            if (catData.length > 0) setSelectedCategoria(catData[0].id);
        }

        // Load Subcategorias
        const { data: subData } = await supabase
            .from('subcategorias')
            .select('*, categorias(nome)')
            .eq('user_id', user!.id)
            .order('created_at', { ascending: true });

        if (subData) {
            setSubcategorias(subData);
        }
        setLoading(false);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNome.trim() || !selectedCategoria || !user) return;

        const { data, error } = await supabase
            .from('subcategorias')
            .insert([{ nome: newNome.trim(), categoria_id: selectedCategoria, user_id: user.id }])
            .select('*, categorias(nome)')
            .single();

        if (!error && data) {
            setSubcategorias(prev => [...prev, data]);
            setNewNome("");
        } else {
            console.error("Erro ao adicionar subcategoria:", error);
            // Ignore error for now, might be connection or policy
            // Wait, if table not exists, it fails. We expect user to create table.
        }
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('subcategorias').delete().eq('id', id);
        if (!error) {
            setSubcategorias(prev => prev.filter(c => c.id !== id));
        }
    };

    const startEdit = (sub: Subcategoria) => {
        setEditingId(sub.id);
        setEditNome(sub.nome);
        setEditCategoriaId(sub.categoria_id);
    };

    const saveEdit = async (id: string) => {
        if (!editNome.trim() || !editCategoriaId) return;

        const updates = {
            nome: editNome.trim(),
            categoria_id: editCategoriaId
        };

        const { error } = await supabase.from('subcategorias').update(updates).eq('id', id);

        if (!error) {
            const cat = categorias.find(c => c.id === editCategoriaId);
            setSubcategorias(subcategorias.map(s => s.id === id ? { ...s, ...updates, categorias: { nome: cat?.nome || '' } } : s));
            setEditingId(null);
        } else {
            console.error("Erro ao editar subcategoria:", error);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-brand-green" /></div>;
    }

    return (
        <div className="animate-in fade-in max-w-2xl">
            <header className="mb-6">
                <h2 className="text-lg font-heading font-bold text-white mb-1 flex items-center gap-2">
                    <FolderTree className="w-5 h-5 text-brand-green" /> Subcategorias de Despesas
                </h2>
                <p className="text-sm text-foreground/60">
                    Crie e gerencie subcategorias vinculadas à suas categorias principais.
                </p>
            </header>

            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-8">
                <div className="flex-1">
                    <input
                        type="text"
                        value={newNome}
                        onChange={(e) => setNewNome(e.target.value)}
                        placeholder="Nome da subcategoria (ex: Mercado, Farmácia)"
                        className="w-full bg-surface border border-borders rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-green transition-colors"
                        required
                    />
                </div>
                <div className="flex-1 sm:max-w-[200px]">
                    <select
                        value={selectedCategoria}
                        onChange={(e) => setSelectedCategoria(e.target.value)}
                        className="w-full bg-surface border border-borders rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-green transition-colors"
                        required
                    >
                        <option value="" disabled>Selecione a Categoria</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                </div>
                <button
                    type="submit"
                    disabled={!newNome.trim() || !selectedCategoria}
                    className="bg-brand-green text-[#0f131a] px-6 py-3 rounded-xl font-bold hover:bg-brand-green/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 min-w-[120px]"
                >
                    <Plus className="w-4 h-4" /> Adicionar
                </button>
            </form>

            <div className="space-y-3">
                {subcategorias.length === 0 ? (
                    <div className="text-center py-8 text-foreground/50 text-sm border border-dashed border-borders rounded-xl">
                        Nenhuma subcategoria cadastrada.
                    </div>
                ) : (
                    subcategorias.map(sub => (
                        <div key={sub.id} className="flex flex-col md:flex-row gap-4 py-3 border-b border-borders group transition-colors items-center justify-between">
                            {editingId === sub.id ? (
                                <div className="flex flex-col md:flex-row gap-3 w-full items-center">
                                    <input
                                        value={editNome}
                                        onChange={(e) => setEditNome(e.target.value)}
                                        className="flex-1 bg-background border border-borders rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                                    />
                                    <select
                                        value={editCategoriaId}
                                        onChange={(e) => setEditCategoriaId(e.target.value)}
                                        className="w-full md:w-auto bg-background border border-borders rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                                    >
                                        <option value="" disabled>Selecione a Categoria</option>
                                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                    <div className="flex gap-2 min-w-max mt-2 md:mt-0">
                                        <button onClick={() => saveEdit(sub.id)} className="p-2 bg-brand-green rounded-lg text-[#0f131a]"><Check className="w-4 h-4" /></button>
                                        <button onClick={() => setEditingId(null)} className="p-2 bg-surface border border-borders rounded-lg"><X className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 flex-1 w-full">
                                        <div className="w-8 h-8 rounded-lg bg-background border border-borders flex items-center justify-center text-foreground/70">
                                            <Tag className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">{sub.nome}</h3>
                                            <p className="text-xs text-brand-green font-medium">Categoria: {sub.categorias?.nome || 'Desconhecida'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDelete(sub.id)}
                                            className="p-2 text-brand-red/70 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => startEdit(sub)}
                                            className="p-2 text-foreground/50 hover:text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
