"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart as BarChartIcon, Printer, Download, Filter } from "lucide-react";

export default function RelatoriosPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [lancamentos, setLancamentos] = useState<any[]>([]);

    // Filters
    const [periodo, setPeriodo] = useState<'ano' | 'mes'>('ano');
    const [ano, setAno] = useState(new Date().getFullYear().toString());
    const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [categoriaFilter, setCategoriaFilter] = useState("todos");
    const [subcategoriaFilter, setSubcategoriaFilter] = useState("todos");

    function formatCurrency(value: number) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    useEffect(() => {
        if (user) fetchData();
    }, [user, periodo, ano, mes]);

    const fetchData = async () => {
        setLoading(true);
        let query = supabase.from('lancamentos').select('*, categorias(nome), subcategorias(nome)').eq('user_id', user!.id);

        if (periodo === 'ano') {
            query = query.like('mes', `${ano}-%`);
        } else {
            query = query.eq('mes', `${ano}-${mes}`);
        }

        const { data } = await query;
        if (data) setLancamentos(data);
        setLoading(false);
    };

    const availableCategorias = Array.from(new Set(lancamentos.filter(t => t.tipo === 'despesa' && t.categorias).map(t => t.categorias.nome)));
    const availableSubcategorias = Array.from(new Set(lancamentos.filter(t => t.tipo === 'despesa' && t.subcategorias && (categoriaFilter === 'todos' || t.categorias?.nome === categoriaFilter)).map(t => t.subcategorias.nome)));

    const lancamentosFiltrados = lancamentos.filter(t => {
        if (t.tipo === 'renda' && categoriaFilter !== 'todos') return false; // Hide income if filtering by category
        if (t.tipo === 'renda') return true;
        const matchCat = categoriaFilter === 'todos' || t.categorias?.nome === categoriaFilter;
        const matchSub = subcategoriaFilter === 'todos' || t.subcategorias?.nome === subcategoriaFilter;
        return matchCat && matchSub;
    });

    // Process Data: Receitas x Despesas
    const chartData = Object.values(lancamentosFiltrados.reduce((acc: any, t: any) => {
        const key = periodo === 'ano' ? t.mes : t.data;
        if (!acc[key]) acc[key] = { name: key, "Receitas": 0, "Despesas": 0 };
        if (t.tipo === 'renda') acc[key]["Receitas"] += t.valor;
        if (t.tipo === 'despesa') acc[key]["Despesas"] += t.valor;
        return acc;
    }, {})).sort((a: any, b: any) => a.name.localeCompare(b.name));

    // Process Data: Despesas por Categoria
    const despesasCategoria = Object.values(lancamentosFiltrados.filter(t => t.tipo === 'despesa').reduce((acc: any, t: any) => {
        const keyName = categoriaFilter === 'todos' ? (t.categorias?.nome || "Sem Categoria") : (t.subcategorias?.nome || t.categorias?.nome || "Sem Subcategoria");
        if (!acc[keyName]) acc[keyName] = { nome: keyName, valor: 0 };
        acc[keyName].valor += t.valor;
        return acc;
    }, {})).sort((a: any, b: any) => b.valor - a.valor);

    const handlePrint = () => {
        window.print();
    };

    const handleExportCSV = () => {
        const headers = ["ID", "Data", "Descrição", "Tipo", "Valor", "Categoria", "Subcategoria", "Forma Pago"];
        const rows = lancamentosFiltrados.map(t => [
            t.id, t.data, `"${t.descricao}"`, t.tipo, t.valor.toFixed(2), `"${t.categorias?.nome || ''}"`, `"${t.subcategorias?.nome || ''}"`, t.status === 'pago' ? 'Sim' : 'Não'
        ]);
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `finfamily_relatorio_${ano}${periodo === 'mes' ? `_${mes}` : ''}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading && lancamentos.length === 0) return <div className="p-8 text-foreground/50 animate-pulse">Gerando relatórios...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto printable-area">
            <header className="pb-6 border-b border-borders flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center border border-brand-blue/20">
                        <BarChartIcon className="text-brand-blue w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-heading font-bold text-white tracking-tight">
                            Relatórios
                        </h1>
                        <p className="text-foreground/60 mt-1">
                            Acompanhe e exporte suas estatísticas financeiras.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 print:hidden">
                    <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 border border-borders rounded-xl text-sm font-bold text-white hover:bg-white/5 transition-colors">
                        <Download className="w-4 h-4" /> Exportar CSV
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-[#0f131a] rounded-xl text-sm font-bold hover:bg-brand-blue/90 transition-colors shadow-lg shadow-brand-blue/20">
                        <Printer className="w-4 h-4" /> Imprimir PDF
                    </button>
                </div>
            </header>

            {/* Filters */}
            <div className="bg-cards border border-borders rounded-2xl p-4 flex flex-wrap gap-4 items-end print:hidden">
                <div className="flex items-center gap-2 text-brand-green font-bold mr-2">
                    <Filter className="w-5 h-5" /> Filtros
                </div>
                <div>
                    <label className="block text-xs font-bold text-foreground/60 mb-1">Período</label>
                    <select value={periodo} onChange={e => setPeriodo(e.target.value as any)} className="bg-surface border border-borders rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-green">
                        <option value="ano">Anual</option>
                        <option value="mes">Mensal</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-foreground/60 mb-1">Ano</label>
                    <select value={ano} onChange={e => setAno(e.target.value)} className="bg-surface border border-borders rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-green">
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                        <option value="2027">2027</option>
                    </select>
                </div>
                {periodo === 'mes' && (
                    <div>
                        <label className="block text-xs font-bold text-foreground/60 mb-1">Mês</label>
                        <select value={mes} onChange={e => setMes(e.target.value)} className="bg-surface border border-borders rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-green">
                            <option value="01">Janeiro</option><option value="02">Fevereiro</option><option value="03">Março</option>
                            <option value="04">Abril</option><option value="05">Maio</option><option value="06">Junho</option>
                            <option value="07">Julho</option><option value="08">Agosto</option><option value="09">Setembro</option>
                            <option value="10">Outubro</option><option value="11">Novembro</option><option value="12">Dezembro</option>
                        </select>
                    </div>
                )}
                {availableCategorias.length > 0 && (
                    <div>
                        <label className="block text-xs font-bold text-foreground/60 mb-1">Categoria</label>
                        <select
                            value={categoriaFilter}
                            onChange={(e) => {
                                setCategoriaFilter(e.target.value);
                                setSubcategoriaFilter('todos');
                            }}
                            className="bg-surface border border-borders rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-green max-w-[160px] truncate"
                        >
                            <option value="todos">Todas</option>
                            {availableCategorias.map((c: any) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                )}
                {availableSubcategorias.length > 0 && (
                    <div>
                        <label className="block text-xs font-bold text-foreground/60 mb-1">Subcategoria</label>
                        <select
                            value={subcategoriaFilter}
                            onChange={(e) => setSubcategoriaFilter(e.target.value)}
                            className="bg-surface border border-borders rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-green max-w-[160px] truncate"
                        >
                            <option value="todos">Todas</option>
                            {availableSubcategorias.map((s: any) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-cards border border-borders rounded-2xl p-6">
                    <h3 className="font-heading font-bold text-white mb-6 text-lg">Receitas x Despesas ({periodo === 'ano' ? ano : `${mes}/${ano}`})</h3>
                    <div className="h-[400px]">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#232b3e" />
                                    <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val)} />
                                    <Tooltip
                                        cursor={{ fill: '#232b3e', opacity: 0.4 }}
                                        contentStyle={{ backgroundColor: '#0f131a', borderColor: '#232b3e', borderRadius: '12px', color: '#fff', fontWeight: 'bold' }}
                                        formatter={(value: any) => [`${formatCurrency(Number(value))}`]}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="Receitas" fill="#00e5a0" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Despesas" fill="#ff4d4d" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-foreground/50 border border-dashed border-borders rounded-xl">
                                Sem dados no período selecionado.
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-cards border border-borders rounded-2xl p-6">
                    <h3 className="font-heading font-bold text-white mb-6 text-lg">Gastos por Categoria</h3>
                    {despesasCategoria.length > 0 ? (
                        <div className="space-y-3">
                            {despesasCategoria.map((cat: any) => (
                                <div key={cat.nome} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-borders">
                                    <span className="font-bold text-sm text-foreground/80">{cat.nome}</span>
                                    <span className="font-sans font-bold text-brand-red">{formatCurrency(cat.valor)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-foreground/50 text-sm">
                            Nenhuma despesa registrada no período.
                        </div>
                    )}
                </div>
            </div>

            {/* Print Styles included inline for simplicity */}
            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; color: black !important; background: white !important; }
                    .print\\:hidden { display: none !important; }
                    ::-webkit-scrollbar { display: none; }
                }
            `}</style>
        </div>
    );
}
