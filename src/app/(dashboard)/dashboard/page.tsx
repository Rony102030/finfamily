"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { ArrowUpCircle, ArrowDownCircle, Banknote, PiggyBank, TrendingUp, AlertCircle, Eye, EyeOff } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function DashboardPage() {
    const { user } = useAuth();
    const { activeMonth, userConfig } = useAppStore();

    const [loading, setLoading] = useState(true);
    const [showValues, setShowValues] = useState(true);
    const [txs, setTxs] = useState<any[]>([]);
    const [fundosTotal, setFundosTotal] = useState(0);

    useEffect(() => {
        if (user && activeMonth) {
            fetchData();
        }
    }, [user, activeMonth]);

    const fetchData = async () => {
        setLoading(true);
        // Load transactions for current month
        const { data: lancamentos } = await supabase
            .from('lancamentos')
            .select('*, categorias(nome, cor, limite_mensal)')
            .eq('user_id', user!.id)
            .eq('mes', activeMonth);

        if (lancamentos) setTxs(lancamentos);

        // Load total funds across all time
        const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user!.id).single();
        if (f) {
            setFundosTotal((f.fixo_saldo || 0) + (f.emergencia_saldo || 0) + (f.outro_saldo || 0) + (f.fundo4_saldo || 0) + (f.fundo5_saldo || 0));
        }

        setLoading(false);
    };

    // Calculate KPIs
    let rendaBruta = 0;
    let despesasTotais = 0;

    // Fund contributions for this month to calculate liquid
    let descontosFundos = 0;

    const categoryTotals: Record<string, { nome: string, cor: string, valor: number, limite: number }> = {};

    txs.forEach(t => {
        if (t.tipo === 'renda') {
            rendaBruta += t.valor;
        } else {
            if (t.categorias && t.categorias.nome.toLowerCase() === 'fundos') {
                descontosFundos += t.valor;
            } else {
                despesasTotais += t.valor;
                if (t.categorias) {
                    if (!categoryTotals[t.categorias.nome]) {
                        categoryTotals[t.categorias.nome] = { nome: t.categorias.nome, cor: t.categorias.cor, valor: 0, limite: t.categorias.limite_mensal || 0 };
                    }
                    categoryTotals[t.categorias.nome].valor += t.valor;
                }
            }
        }
    });

    const rendaLiquida = rendaBruta - descontosFundos;
    const sobraMes = rendaLiquida - despesasTotais;

    // Charts Data
    const categoryChartData = Object.values(categoryTotals).sort((a, b) => b.valor - a.valor);

    const donutData = [
        { name: 'Renda Líquida Alocada', value: rendaLiquida, color: '#00e5a0' },
        { name: 'Fundos (Poupado)', value: descontosFundos, color: '#4d9fff' },
        { name: 'Despesas', value: despesasTotais, color: '#ff4d4d' }
    ].filter(d => d.value > 0);

    // Alerts
    const limitAlerts = Object.values(categoryTotals).filter(c => c.limite > 0 && c.valor >= c.limite * 0.9);

    if (loading) return <div className="p-8 text-foreground/50 animate-pulse">Calculando dashboard...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="pb-6 border-b border-borders flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-heading font-bold text-white tracking-tight">
                            Dashboard
                        </h1>
                        <button onClick={() => setShowValues(!showValues)} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-foreground/70 hover:text-white hover:bg-white/10 transition-colors" title={showValues ? "Ocultar Valores" : "Mostrar Valores"}>
                            {showValues ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                        </button>
                    </div>
                    <p className="text-foreground/60 mt-1">
                        Visão geral de suas finanças em <span className="text-brand-green font-medium">{activeMonth}</span>
                    </p>
                </div>
            </header>

            {limitAlerts.length > 0 && (
                <div className="bg-brand-red/10 border border-brand-red/20 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <AlertCircle className="text-brand-red w-6 h-6 flex-shrink-0" />
                    <div className="text-sm">
                        <strong className="text-brand-red block mb-1">Atenção aos limites de categoria!</strong>
                        {limitAlerts.map(a => (
                            <span key={a.nome} className="text-brand-red/80 mr-4">
                                {a.nome}: {formatCurrency(a.valor)} / {formatCurrency(a.limite)}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard title="Renda Bruta" value={rendaBruta} icon={<TrendingUp className="w-5 h-5" />} color="text-foreground/80" showValues={showValues} />
                <KpiCard title="Líquido (p/ Gastos)" value={rendaLiquida} icon={<ArrowUpCircle className="w-5 h-5" />} color="text-brand-green" bgColor="bg-brand-green/10" showValues={showValues} />
                <KpiCard title="Despesas Totais" value={despesasTotais} icon={<ArrowDownCircle className="w-5 h-5" />} color="text-brand-red" bgColor="bg-brand-red/10" showValues={showValues} />
                <KpiCard title="Sobra do Mês" value={sobraMes} icon={<Banknote className="w-5 h-5" />} color={sobraMes >= 0 ? "text-brand-blue" : "text-brand-red"} bgColor={sobraMes >= 0 ? "bg-brand-blue/10" : "bg-brand-red/10"} showValues={showValues} />
                <KpiCard title="Fundos Total (Todos meses)" value={fundosTotal} icon={<PiggyBank className="w-5 h-5" />} color="text-brand-yellow" bgColor="bg-brand-yellow/10" showValues={showValues} />
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Gastos por categoria */}
                <div className="lg:col-span-2 bg-cards border border-borders rounded-2xl p-6">
                    <h3 className="font-heading font-bold text-white mb-6 text-lg">Gastos por Categoria</h3>
                    <div className="h-[300px]">
                        {categoryChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryChartData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#232b3e" />
                                    <XAxis type="number" stroke="#64748b" tickLine={false} axisLine={false} tickFormatter={(val) => showValues ? formatCurrency(val) : ''} />
                                    <YAxis dataKey="nome" type="category" stroke="#f8fafc" tickLine={false} axisLine={false} fontSize={12} width={100} />
                                    <Tooltip
                                        cursor={{ fill: '#232b3e', opacity: 0.4 }}
                                        contentStyle={{ backgroundColor: '#0f131a', borderColor: '#232b3e', borderRadius: '12px', color: '#fff' }}
                                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                        formatter={(value: any) => [`${showValues ? formatCurrency(Number(value)) : '••••••'}`, 'Gasto']}
                                    />
                                    <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={24}>
                                        {categoryChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.cor || '#4d9fff'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-foreground/50 border border-dashed border-borders rounded-xl">Nenhuma despesa registrada.</div>
                        )}
                    </div>
                </div>

                {/* Donut de Distribuicao */}
                <div className="bg-cards border border-borders rounded-2xl p-6">
                    <h3 className="font-heading font-bold text-white mb-6 text-lg">Composição do Mês</h3>
                    <div className="h-[240px] relative">
                        {donutData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {donutData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f131a', borderColor: '#232b3e', borderRadius: '12px', color: '#fff', zIndex: 50 }}
                                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                        formatter={(value: any, name: any) => [`${showValues ? formatCurrency(Number(value)) : '••••••'}`, name]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-foreground/50 border border-dashed border-borders rounded-xl">Sem dados para composição.</div>
                        )}
                        {donutData.length > 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xs text-foreground/50 uppercase tracking-widest font-bold">Resumo</span>
                            </div>
                        )}
                    </div>
                    {/* Legenda Customizada */}
                    {donutData.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {donutData.map(d => (
                                <div key={d.name} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                                        <span className="text-foreground/80">{d.name}</span>
                                    </div>
                                    <span className="font-bold text-white">{showValues ? formatCurrency(d.value) : '••••••'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

function KpiCard({ title, value, icon, color, bgColor = "bg-surface", showValues = true }: { title: string, value: number, icon: any, color: string, bgColor?: string, showValues?: boolean }) {
    return (
        <div className={`border border-borders rounded-2xl p-5 ${bgColor} bg-opacity-30 backdrop-blur-sm relative overflow-hidden group`}>
            <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-20 transition-transform group-hover:scale-150 ${color.replace('text-', 'bg-')}`}></div>
            <div className={`flex items-center gap-2 mb-3 text-sm font-bold ${color}`}>
                <div className="p-1.5 bg-background rounded-lg shadow-sm border border-borders/50">
                    {icon}
                </div>
                <span>{title}</span>
            </div>
            <p className="text-2xl font-sans font-bold text-white tracking-tight">
                {showValues ? formatCurrency(value) : '••••••'}
            </p>
        </div>
    );
}
