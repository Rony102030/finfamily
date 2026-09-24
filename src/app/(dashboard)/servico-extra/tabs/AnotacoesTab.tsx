"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { StickyNote, Plus, Trash2, Edit2, Check, X } from "lucide-react";

export function AnotacoesTab() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [notas, setNotas] = useState<any[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditingId, setIsEditingId] = useState<string | null>(null);

    const [formTitle, setFormTitle] = useState("");
    const [formContent, setFormContent] = useState("");

    useEffect(() => {
        if (user) {
            fetchNotas();
        }
    }, [user]);

    const fetchNotas = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('servico_extra_notas')
            .select('*')
            .eq('user_id', user!.id)
            .order('created_at', { ascending: false });

        if (data) setNotas(data);
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim() || !user) return;

        setIsSubmitting(true);
        
        if (isEditingId) {
            const { error } = await supabase
                .from('servico_extra_notas')
                .update({ titulo: formTitle, conteudo: formContent })
                .eq('id', isEditingId)
                .eq('user_id', user.id);
            
            if (!error) {
                setNotas(notas.map(n => n.id === isEditingId ? { ...n, titulo: formTitle, conteudo: formContent } : n));
                resetForm();
            } else {
                alert("Erro ao atualizar anotação.");
            }
        } else {
            const { data: newNota, error } = await supabase
                .from('servico_extra_notas')
                .insert({
                    user_id: user.id,
                    titulo: formTitle,
                    conteudo: formContent
                })
                .select()
                .single();

            if (!error && newNota) {
                setNotas([newNota, ...notas]);
                resetForm();
            } else {
                alert("Erro ao criar anotação.");
            }
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta anotação?")) return;
        const { error } = await supabase.from('servico_extra_notas').delete().eq('id', id);
        if (!error) {
            setNotas(notas.filter(n => n.id !== id));
            if (isEditingId === id) resetForm();
        }
    };

    const handleEdit = (nota: any) => {
        setIsEditingId(nota.id);
        setFormTitle(nota.titulo);
        setFormContent(nota.conteudo || "");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setIsEditingId(null);
        setFormTitle("");
        setFormContent("");
    };

    if (loading) {
        return <div className="p-8 text-foreground/50 animate-pulse text-center">Carregando dados...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form column */}
                <div className="lg:col-span-1">
                    <form onSubmit={handleSave} className="secao space-y-4 lg:sticky lg:top-24">
                        <div className="flex items-center justify-between">
                            <h3 className="font-heading font-bold text-white text-lg">
                                {isEditingId ? 'Editar Anotação' : 'Nova Anotação'}
                            </h3>
                            {isEditingId && (
                                <button type="button" onClick={resetForm} className="text-foreground/50 hover:text-white transition-colors p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-foreground/70 mb-1">Título</label>
                            <input
                                type="text"
                                required
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="Ex: Senhas, Conta Bancária..."
                                className="w-full bg-surface border border-borders rounded-xl px-4 py-2 text-white outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-foreground/70 mb-1">Conteúdo</label>
                            <textarea
                                rows={6}
                                value={formContent}
                                onChange={(e) => setFormContent(e.target.value)}
                                placeholder="Escreva os detalhes aqui..."
                                className="w-full bg-surface border border-borders rounded-xl px-4 py-2 text-white outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all resize-none text-sm placeholder:text-foreground/40"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 ${isEditingId ? 'bg-brand-green hover:bg-brand-green/90 text-background' : 'bg-brand-blue hover:bg-brand-blue/90 text-background'}`}
                        >
                            {isSubmitting ? 'Salvando...' : (
                                <>
                                    {isEditingId ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                    {isEditingId ? 'Atualizar' : 'Adicionar'}
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* List column */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-heading font-bold text-white text-lg">Suas Anotações</h3>
                    {notas.length === 0 ? (
                        <div className="text-center py-12 border-b border-borders">
                            <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-3">
                                <StickyNote className="w-6 h-6 text-foreground/40" />
                            </div>
                            <p className="text-foreground/60 font-medium">Nenhuma anotação ainda</p>
                            <p className="text-sm text-foreground/40 mt-1">Salve contas, senhas e outros dados aqui.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {notas.map(nota => (
                                <div key={nota.id} className="border-b border-borders py-4 flex flex-col group relative overflow-hidden transition-all hover:border-brand-blue/50 min-h-[160px]">
                                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleEdit(nota)}
                                            className="p-1.5 bg-surface text-foreground/60 hover:text-brand-blue rounded-md transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(nota.id)}
                                            className="p-1.5 bg-surface text-foreground/60 hover:text-brand-red rounded-md transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    
                                    <h4 className="font-bold text-white mb-2 pr-12 line-clamp-1">{nota.titulo}</h4>
                                    
                                    <div className="text-sm text-foreground/70 whitespace-pre-wrap flex-grow">
                                        {nota.conteudo}
                                    </div>
                                    
                                    <div className="mt-4 pt-3 border-t border-borders/50 text-[10px] text-foreground/40">
                                        {new Date(nota.created_at).toLocaleString('pt-BR')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
