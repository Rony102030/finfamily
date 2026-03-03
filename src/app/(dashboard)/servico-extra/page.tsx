"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { Briefcase, Plus, Trash2, ArrowUpCircle, ArrowDownCircle, DollarSign, Edit2, Check, X } from "lucide-react";

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function ServicoExtraPage() {
    const { user } = useAuth();
    const { userConfig } = useAppStore();

    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<any[]>([]);

    // Form state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita');
    const [valor, setValor] = useState("");
    const [data, setData] = useState(new Date().toISOString().split('T')[0]);
    const [observacao, setObservacao] = useState("");

    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState("");

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        const { data: servicoData } = await supabase
            .from('servico_extra')
            .select('*')
            .eq('user_id', user!.id)
            .order('data', { ascending: false })
            .order('created_at', { ascending: false });

        if (servicoData) setEntries(servicoData);
        setLoading(false);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valor || !data || !user) return;

        setIsSubmitting(true);
        const { data: newEntry, error } = await supabase
            .from('servico_extra')
            .insert({
                user_id: user.id,
                tipo,
                valor: parseFloat(valor.replace(',', '.')),
                data,
                observacao
            })
            .select()
            .single();

        setIsSubmitting(false);

        if (!error && newEntry) {
            setEntries([newEntry, ...entries].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()));
            setValor("");
            setObservacao("");
        } else {
            alert("Erro ao adicionar registro.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir?")) return;
        const { error } = await supabase.from('servico_extra').delete().eq('id', id);
        if (!error) {
            setEntries(entries.filter(e => e.id !== id));
        }
    };

    // Calcular KPIs
    let faturamento = 0;
    let custo = 0;

    entries.forEach(e => {
        if (e.tipo === 'receita') faturamento += e.valor;
        else custo += e.valor;
    });

    const lucroLiquido = faturamento - custo;

    const tabName = userConfig?.servico_extra_nome || "Serviço Extra";

    const handleSaveName = async () => {
        if (!tempName.trim() || !user) return;
        const { error } = await supabase.from('config').update({ servico_extra_nome: tempName }).eq('user_id', user.id);
        if (!error && userConfig) {
            useAppStore.getState().setUserConfig({ ...userConfig, servico_extra_nome: tempName });
            setIsEditingName(false);
        } else {
            alert("Erro ao salvar nome.");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <header className="pb-6 border-b border-borders flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <Briefcase className="w-8 h-8 text-brand-blue" />

                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    type="text"
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    className="bg-surface border border-brand-blue rounded-lg px-3 py-1 text-white font-bold outline-none ring-1 ring-brand-blue"
                                    placeholder="Novo nome..."
                                />
                                <button onClick={handleSaveName} className="p-1.5 text-brand-green hover:bg-white/5 rounded-lg transition-colors">
                                    <Check className="w-5 h-5" />
                                </button>
                                <button onClick={() => setIsEditingName(false)} className="p-1.5 text-foreground/50 hover:text-brand-red hover:bg-white/5 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group">
                                <h1 className="text-2xl font-heading font-bold text-white tracking-tight">
                                    {tabName}
                                </h1>
                                <button
                                    onClick={() => {
                                        setTempName(tabName);
                                        setIsEditingName(true);
                                    }}
                                    className="p-1.5 text-foreground/50 hover:text-brand-blue rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-white/5"
                                    title="Renomear aba"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                    <p className="text-foreground/60 mt-1">
                        Área de controle totalmente isolada para não afetar seu relatório financeiro principal.
                    </p>
                </div>
            </header>

            {loading ? (
                <div className="p-8 text-foreground/50 animate-pulse text-center">Carregando dados...</div>
            ) : (
                <>
                    {/* Mini Dashboard KPI */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <KpiCard title="Faturamento" value={faturamento} icon={<ArrowUpCircle className="w-5 h-5 text-brand-green" />} color="text-brand-green" bgColor="bg-brand-green/10" />
                        <KpiCard title="Custo" value={custo} icon={<ArrowDownCircle className="w-5 h-5 text-brand-red" />} color="text-brand-red" bgColor="bg-brand-red/10" />
                        <KpiCard title="Lucro Líquido" value={lucroLiquido} icon={<DollarSign className="w-5 h-5 text-brand-blue" />} color={lucroLiquido >= 0 ? "text-brand-blue" : "text-brand-red"} bgColor={lucroLiquido >= 0 ? "bg-brand-blue/10" : "bg-brand-red/10"} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Formulário */}
                        <div className="lg:col-span-1">
                            <form onSubmit={handleAdd} className="bg-cards border border-borders rounded-2xl p-6 space-y-4 sticky top-24">
                                <h3 className="font-heading font-bold text-white text-lg">Novo Registro</h3>

                                <div className="p-1 bg-surface rounded-xl flex gap-1 border border-borders">
                                    <button
                                        type="button"
                                        onClick={() => setTipo('receita')}
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${tipo === 'receita' ? 'bg-brand-green/20 text-brand-green' : 'text-foreground/50 hover:text-white'}`}
                                    >
                                        Receita (+ Faturamento)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTipo('despesa')}
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${tipo === 'despesa' ? 'bg-brand-red/20 text-brand-red' : 'text-foreground/50 hover:text-white'}`}
                                    >
                                        Despesa (- Custo)
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-foreground/70 mb-1">Data</label>
                                    <input
                                        type="date"
                                        required
                                        value={data}
                                        onChange={(e) => setData(e.target.value)}
                                        className="w-full bg-surface border border-borders rounded-xl px-4 py-2.5 text-white outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-foreground/70 mb-1">Valor</label>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-4 text-foreground/50 font-medium">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            required
                                            value={valor}
                                            onChange={(e) => setValor(e.target.value)}
                                            className="w-full bg-surface border border-borders rounded-xl pl-12 pr-4 py-2.5 text-white outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all text-lg font-bold placeholder:font-normal placeholder:text-foreground/30"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-foreground/70 mb-1">Observação</label>
                                    <textarea
                                        rows={3}
                                        value={observacao}
                                        onChange={(e) => setObservacao(e.target.value)}
                                        placeholder="Ex: Tráfego Ads, Venda Produto X..."
                                        className="w-full bg-surface border border-borders rounded-xl px-4 py-2 text-white outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all resize-none text-sm placeholder:text-foreground/40"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-brand-blue hover:bg-brand-blue/90 text-background font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Salvando...' : (
                                        <>
                                            <Plus className="w-5 h-5" /> Adicionar
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Histórico */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="font-heading font-bold text-white text-lg">Histórico de Lançamentos</h3>
                            {entries.length === 0 ? (
                                <div className="text-center py-12 bg-cards rounded-2xl border border-dashed border-borders">
                                    <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Briefcase className="w-6 h-6 text-foreground/40" />
                                    </div>
                                    <p className="text-foreground/60 font-medium">Nenhum registro ainda</p>
                                    <p className="text-sm text-foreground/40 mt-1">Seus lançamentos aparecerão aqui.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {entries.map(e => (
                                        <div key={e.id} className="bg-cards border border-borders rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${e.tipo === 'receita' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-red/10 text-brand-red'}`}>
                                                    {e.tipo === 'receita' ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium break-words sm:line-clamp-1 max-w-[200px] sm:max-w-xs">{e.observacao || (e.tipo === 'receita' ? 'Receita' : 'Despesa')}</p>
                                                    <p className="text-xs text-foreground/50">
                                                        {new Date(e.data + "T00:00:00").toLocaleDateString('pt-BR')}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto mt-2 sm:mt-0 gap-4 pl-14 sm:pl-0">
                                                <span className={`font-bold ${e.tipo === 'receita' ? 'text-brand-green' : 'text-brand-red'}`}>
                                                    {e.tipo === 'receita' ? '+' : '-'}{formatCurrency(e.valor)}
                                                </span>
                                                <button
                                                    onClick={() => handleDelete(e.id)}
                                                    className="p-2 text-foreground/40 hover:text-brand-red rounded-lg hover:bg-white/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function KpiCard({ title, value, icon, color, bgColor }: { title: string, value: number, icon: any, color: string, bgColor: string }) {
    return (
        <div className={`border border-borders rounded-2xl p-5 ${bgColor} bg-opacity-30 backdrop-blur-sm relative overflow-hidden group`}>
            <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-20 transition-transform group-hover:scale-150 ${color.replace('text-', 'bg-')}`}></div>
            <div className={`flex items-center justify-between mb-3 text-sm font-bold ${color}`}>
                <span className="text-white/90">{title}</span>
                <div className="p-1.5 bg-background rounded-lg shadow-sm border border-borders/50">
                    {icon}
                </div>
            </div>
            <p className={`text-2xl font-sans font-bold tracking-tight ${color}`}>
                {formatCurrency(value)}
            </p>
        </div>
    );
}
