"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { formatMonth } from "@/lib/format";
import { ArrowUpCircle, ArrowDownCircle, Banknote, PiggyBank, TrendingUp, AlertCircle, Eye, EyeOff, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area } from 'recharts';
import { DateRangePicker } from "@/components/DateRangePicker";
import { carregarCaixinhas, guardadoNoMes, saldoCaixinha } from "@/lib/caixinhas";

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function DashboardPage() {
    const { user } = useAuth();
    const { activeMonth, userConfig } = useAppStore();

    const [loading, setLoading] = useState(true);
    const [showValues, setShowValues] = useState(true);
    const [txs, setTxs] = useState<any[]>([]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [guardadoMes, setGuardadoMes] = useState(0);
    const [fundosTotal, setFundosTotal] = useState(0);
    const [prevMonthTxs, setPrevMonthTxs] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<{ mes: string, liquido: number, despesas: number }[]>([]);

    const getPrevMonth = (month: string) => {
        const [y, m] = month.split("-").map(Number);
        const d = new Date(y, m - 2, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const getLast6Months = (month: string) => {
        const months: string[] = [];
        let [y, m] = month.split("-").map(Number);
        for (let i = 5; i >= 0; i--) {
            const d = new Date(y, m - 1 - i, 1);
            months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return months;
    };

    useEffect(() => {
        if (user && activeMonth) {
            fetchData();
        }
    }, [user, activeMonth]);

    const fetchData = async () => {
        setLoading(true);
        const prevMonth = getPrevMonth(activeMonth);
        const last6 = getLast6Months(activeMonth);

        const [currentRes, prevRes, trendRes, caixinhas] = await Promise.all([
            supabase.from('lancamentos').select('*, categorias(nome, cor, limite_mensal)').eq('user_id', user!.id).eq('mes', activeMonth),
            supabase.from('lancamentos').select('*, categorias(nome)').eq('user_id', user!.id).eq('mes', prevMonth),
            supabase.from('lancamentos').select('mes, tipo, valor').eq('user_id', user!.id).in('mes', last6),
            carregarCaixinhas(user!.id, activeMonth).catch(() => null),
        ]);

        // O que foi guardado nas caixinhas no mês sai do "Líquido p/ Gastos"
        const movimentos = caixinhas?.movimentos || [];
        if (currentRes.data) setTxs(currentRes.data);
        setGuardadoMes(guardadoNoMes(movimentos, activeMonth));
        setFundosTotal(caixinhas ? caixinhas.caixinhas.reduce((s, c) => s + saldoCaixinha(c, caixinhas.movimentos, caixinhas.gastos), 0) : 0);
        if (prevRes.data) setPrevMonthTxs(prevRes.data);

        if (trendRes.data) {
            const grouped: Record<string, { receitas: number, despesas: number }> = {};
            last6.forEach(m => { grouped[m] = { receitas: 0, despesas: 0 }; });
            trendRes.data.forEach((t: any) => {
                if (!grouped[t.mes]) return;
                if (t.tipo === 'renda') grouped[t.mes].receitas += t.valor;
                else grouped[t.mes].despesas += t.valor;
            });

            setTrendData(last6.map(m => ({
                mes: m,
                liquido: grouped[m].receitas - guardadoNoMes(movimentos, m),
                despesas: grouped[m].despesas,
            })));
        }

        setLoading(false);
    };

    // Calculate KPIs
    let rendaBruta = 0;
    let despesasTotais = 0;

    const descontosFundos = guardadoMes;

    const categoryTotals: Record<string, { nome: string, cor: string, valor: number, limite: number }> = {};

    const filteredTxs = txs.filter(t => {
        if (!startDate && !endDate) return true;
        const tDate = t.data;
        if (!tDate) return true;
        if (startDate && tDate < startDate) return false;
        if (endDate && tDate > endDate) return false;
        return true;
    });

    filteredTxs.forEach(t => {
        if (t.tipo === 'renda') {
            rendaBruta += t.valor;
        } else {
            if (t.categorias && t.categorias.nome.toLowerCase() === 'fundos') {
                // Categoria antiga "Fundos": o guardado agora vem das caixinhas
            } else if (t.categorias && (t.categorias.nome.toLowerCase().includes('emergên') || t.categorias.nome.toLowerCase().includes('emergencia'))) {
                // Emergência: ocultar do Dashboard — vem do saldo do fundo, não do orçamento do mês
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
        { name: 'Guardado nas caixinhas', value: descontosFundos, color: '#4d9fff' },
        { name: 'Despesas', value: despesasTotais, color: '#ff4d4d' }
    ].filter(d => d.value > 0);

    // Alerts — categories at 80%+ of their limit
    const budgetAlerts = Object.values(categoryTotals)
        .filter(c => c.limite > 0 && c.valor >= c.limite * 0.8)
        .map(c => ({ ...c, pct: Math.round((c.valor / c.limite) * 100), exceeded: c.valor >= c.limite }))
        .sort((a, b) => b.pct - a.pct);

    // Previous month comparison
    let prevDespesas = 0;
    let prevReceitas = 0;
    prevMonthTxs.forEach(t => {
        if (t.tipo === 'renda') prevReceitas += t.valor;
        else {
            if (t.categorias && (t.categorias.nome.toLowerCase() === 'fundos' || t.categorias.nome.toLowerCase().includes('emergên') || t.categorias.nome.toLowerCase().includes('emergencia'))) return;
            prevDespesas += t.valor;
        }
    });

    const despesaDiff = prevDespesas > 0 ? ((despesasTotais - prevDespesas) / prevDespesas) * 100 : 0;
    const receitaDiff = prevReceitas > 0 ? ((rendaBruta - prevReceitas) / prevReceitas) * 100 : 0;

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
                        Visão geral de suas finanças em <span className="text-brand-green font-medium">{formatMonth(activeMonth)}</span>
                    </p>
                </div>
            </header>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-surface border border-borders rounded-2xl p-4">
                <span className="text-sm font-semibold text-foreground/80 flex-shrink-0">Filtrar Período:</span>
                <div className="w-full sm:w-auto">
                    <DateRangePicker 
                        startDate={startDate} 
                        endDate={endDate} 
                        onChange={(start: string, end: string) => {
                            setStartDate(start);
                            setEndDate(end);
                        }} 
                    />
                </div>
            </div>

            {budgetAlerts.length > 0 && (
                <div className="bg-cards border border-borders rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="text-brand-red w-5 h-5" />
                        <h3 className="font-heading font-bold text-white text-sm">Alertas de Orçamento</h3>
                    </div>
                    {budgetAlerts.map(a => (
                        <div key={a.nome} className="space-y-1.5">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-foreground/80">{a.nome}</span>
                                <span className={`font-bold ${a.exceeded ? 'text-brand-red' : 'text-brand-yellow'}`}>
                                    {a.pct}% — {showValues ? formatCurrency(a.valor) : '••••••'} / {showValues ? formatCurrency(a.limite) : '••••••'}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${a.exceeded ? 'bg-brand-red' : a.pct >= 90 ? 'bg-brand-yellow' : 'bg-brand-green'}`}
                                    style={{ width: `${Math.min(a.pct, 100)}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard title="Renda Bruta" value={rendaBruta} icon={<TrendingUp className="w-5 h-5" />} color="text-foreground/80" showValues={showValues} />
                <KpiCard title="Líquido (p/ Gastos)" value={rendaLiquida} icon={<ArrowUpCircle className="w-5 h-5" />} color="text-brand-green" bgColor="bg-brand-green/10" showValues={showValues} />
                <KpiCard title="Despesas Totais" value={despesasTotais} icon={<ArrowDownCircle className="w-5 h-5" />} color="text-brand-red" bgColor="bg-brand-red/10" showValues={showValues} />
                <KpiCard title="Sobra do Mês" value={sobraMes} icon={<Banknote className="w-5 h-5" />} color={sobraMes >= 0 ? "text-brand-blue" : "text-brand-red"} bgColor={sobraMes >= 0 ? "bg-brand-blue/10" : "bg-brand-red/10"} showValues={showValues} />
                <KpiCard title="Caixinhas (total guardado)" value={fundosTotal} icon={<PiggyBank className="w-5 h-5" />} color="text-brand-yellow" bgColor="bg-brand-yellow/10" showValues={showValues} />
            </div>

            {/* Month Comparison + Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Comparison vs Previous Month */}
                <div className="bg-cards border border-borders rounded-2xl p-6">
                    <h3 className="font-heading font-bold text-white mb-4 text-lg">vs. Mês Anterior</h3>
                    <div className="space-y-4">
                        <ComparisonRow label="Receitas" current={rendaBruta} diff={receitaDiff} showValues={showValues} />
                        <ComparisonRow label="Despesas" current={despesasTotais} diff={despesaDiff} inverted showValues={showValues} />
                        <ComparisonRow label="Sobra" current={sobraMes} diff={prevDespesas > 0 || prevReceitas > 0 ? ((sobraMes - (prevReceitas - prevDespesas)) / Math.max(prevReceitas - prevDespesas, 1)) * 100 : 0} showValues={showValues} />
                    </div>
                </div>

                {/* 6-Month Trend Sparkline */}
                <div className="lg:col-span-2 bg-cards border border-borders rounded-2xl p-6">
                    <h3 className="font-heading font-bold text-white mb-4 text-lg">Evolução dos Últimos 6 Meses</h3>
                    <div className="h-[180px]">
                        {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradLiquido" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#00e5a0" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#00e5a0" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ff4d4d" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ff4d4d" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#232b3e" />
                                    <XAxis dataKey="mes" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(val) => { const [, m] = val.split('-'); const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return names[parseInt(m)-1]; }} />
                                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(val) => showValues ? `${(val/1000).toFixed(0)}k` : ''} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f131a', borderColor: '#232b3e', borderRadius: '12px', color: '#fff' }}
                                        formatter={(value: any, name: string) => [showValues ? formatCurrency(Number(value)) : '••••••', name === 'liquido' ? 'Líquido p/ Gastos' : 'Despesas']}
                                        labelFormatter={(label) => formatMonth(label)}
                                    />
                                    <Area type="monotone" dataKey="liquido" stroke="#00e5a0" strokeWidth={2} fill="url(#gradLiquido)" />
                                    <Area type="monotone" dataKey="despesas" stroke="#ff4d4d" strokeWidth={2} fill="url(#gradDespesas)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-foreground/50 border border-dashed border-borders rounded-xl">Sem dados suficientes.</div>
                        )}
                    </div>
                    <div className="flex items-center gap-6 mt-3 text-xs text-foreground/60">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-1 rounded bg-[#00e5a0]"></div> Líquido p/ Gastos</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-1 rounded bg-[#ff4d4d]"></div> Despesas</div>
                    </div>
                </div>
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

function ComparisonRow({ label, current, diff, inverted = false, showValues = true }: { label: string, current: number, diff: number, inverted?: boolean, showValues?: boolean }) {
    const isPositive = inverted ? diff < 0 : diff > 0;
    const isNeutral = Math.abs(diff) < 0.5;
    const color = isNeutral ? 'text-foreground/50' : isPositive ? 'text-brand-green' : 'text-brand-red';

    return (
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-foreground/60">{label}</p>
                <p className="text-lg font-bold text-white">{showValues ? formatCurrency(current) : '••••••'}</p>
            </div>
            {diff !== 0 ? (
                <div className={`flex items-center gap-1 text-sm font-bold ${color}`}>
                    {isNeutral ? <Minus className="w-3.5 h-3.5" /> : isPositive ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                    <span>{Math.abs(Math.round(diff))}%</span>
                </div>
            ) : (
                <span className="text-xs text-foreground/40">Sem dados anteriores</span>
            )}
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
