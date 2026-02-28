"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { PiggyBank, ArrowUpRight, ShieldCheck, Wallet, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAppStore } from "@/store";

export default function FundosPage() {
    const { user } = useAuth();
    const { userConfig } = useAppStore();
    const [fundos, setFundos] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        // Load actual balances
        const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user!.id).single();
        if (f) setFundos(f);

        // Load contribution history
        const { data: h } = await supabase.from('contribuicoes').select('mes, fixo_valor, emergencia_valor, outro_valor').eq('user_id', user!.id).order('mes', { ascending: true });

        if (h && h.length > 0) {
            // Aggregate by month for the chart and table
            const grouped = Object.values(h.reduce((acc: any, curr: any) => {
                if (!acc[curr.mes]) {
                    acc[curr.mes] = { mes: curr.mes, fixo: 0, emergencia: 0, outro: 0 };
                }
                acc[curr.mes].fixo += curr.fixo_valor;
                acc[curr.mes].emergencia += curr.emergencia_valor;
                acc[curr.mes].outro += curr.outro_valor;
                return acc;
            }, {}));

            setHistory(grouped.reverse()); // Table ordered newest first

            // Chart data ordered oldest first and accumulated
            const sortedGroupes = [...grouped].reverse(); // oldest first
            let accF = 0, accE = 0, accO = 0;
            const cData = sortedGroupes.map((g: any) => {
                accF += g.fixo;
                accE += g.emergencia;
                accO += g.outro;
                return {
                    name: g.mes,
                    "Renda Fixa": accF,
                    "Emergência": accE,
                    "Outro": accO,
                    total: accF + accE + accO
                };
            });
            setChartData(cData);
        }
        setLoading(false);
    };

    if (loading) return <div className="p-8 animate-pulse text-foreground/50">Carregando fundos...</div>;

    const totalAcumulado = (fundos?.fixo_saldo || 0) + (fundos?.emergencia_saldo || 0) + (fundos?.outro_saldo || 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="pb-6 border-b border-borders flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
                        <PiggyBank className="text-brand-yellow w-6 h-6" /> Fundos Acumulativos
                    </h1>
                    <p className="text-foreground/60 mt-1">
                        Seu patrimônio crescendo mês a mês, sem resetar.
                    </p>
                </div>
                <div className="text-right bg-brand-yellow/10 border border-brand-yellow/20 px-4 py-2 rounded-xl">
                    <p className="text-xs text-brand-yellow font-bold uppercase tracking-wider">Total Acumulado</p>
                    <p className="text-xl font-sans font-bold text-brand-yellow">R$ {totalAcumulado.toFixed(2)}</p>
                </div>
            </header>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-cards border border-borders rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-brand-blue/20"></div>
                    <div className="flex items-center gap-3 mb-4 text-brand-blue">
                        <TrendingUp className="w-5 h-5" />
                        <span className="font-semibold">Renda Fixa</span>
                    </div>
                    <p className="text-3xl font-sans font-bold text-white mb-2">R$ {fundos?.fixo_saldo.toFixed(2)}</p>
                    <div className="flex items-center gap-2 text-sm text-brand-blue">
                        <span className="bg-brand-blue/20 px-2 py-0.5 rounded-full text-xs font-bold">{userConfig?.pct_fixo}% de cada renda</span>
                    </div>
                </div>

                <div className="bg-cards border border-borders rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-yellow/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-brand-yellow/20"></div>
                    <div className="flex items-center gap-3 mb-4 text-brand-yellow">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="font-semibold">Emergência</span>
                    </div>
                    <p className="text-3xl font-sans font-bold text-white mb-2">R$ {fundos?.emergencia_saldo.toFixed(2)}</p>
                    <div className="flex items-center gap-2 text-sm text-brand-yellow">
                        <span className="bg-brand-yellow/20 px-2 py-0.5 rounded-full text-xs font-bold">{userConfig?.pct_emergencia}% de cada renda</span>
                    </div>
                </div>

                {(userConfig?.pct_outro || 0) > 0 && (
                    <div className="bg-cards border border-borders rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-brand-purple/20"></div>
                        <div className="flex items-center gap-3 mb-4 text-brand-purple">
                            <Wallet className="w-5 h-5" />
                            <span className="font-semibold">{fundos?.outro_nome || 'Fundo 3'}</span>
                        </div>
                        <p className="text-3xl font-sans font-bold text-white mb-2">R$ {fundos?.outro_saldo.toFixed(2)}</p>
                        <div className="flex items-center gap-2 text-sm text-brand-purple">
                            <span className="bg-brand-purple/20 px-2 py-0.5 rounded-full text-xs font-bold">{userConfig?.pct_outro}% de cada renda</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Chart */}
            <div className="bg-cards border border-borders rounded-2xl p-6">
                <h3 className="text-lg font-heading font-bold text-white mb-6">Evolução dos Fundos</h3>
                {chartData.length > 0 ? (
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorFixo" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4d9fff" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#4d9fff" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorEme" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ffc94d" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ffc94d" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#b57bff" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#b57bff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#232b3e" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#161b27', borderColor: '#232b3e', borderRadius: '12px', color: '#fff' }}
                                    itemStyle={{ color: '#e2e8f0', fontSize: '14px' }}
                                />
                                <Area type="monotone" dataKey="Renda Fixa" stroke="#4d9fff" fillOpacity={1} fill="url(#colorFixo)" strokeWidth={2} />
                                <Area type="monotone" dataKey="Emergência" stroke="#ffc94d" fillOpacity={1} fill="url(#colorEme)" strokeWidth={2} />
                                {(userConfig?.pct_outro || 0) > 0 && (
                                    <Area type="monotone" dataKey="Outro" stroke="#b57bff" fillOpacity={1} fill="url(#colorOut)" strokeWidth={2} />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-48 flex items-center justify-center text-foreground/50 border border-dashed border-borders rounded-xl">
                        Nenhuma contribuição registrada ainda. Registre receitas para ver o gráfico.
                    </div>
                )}
            </div>

            {/* History Table */}
            <div className="bg-cards border border-borders rounded-2xl p-6">
                <h3 className="text-lg font-heading font-bold text-white mb-6">Histórico de Contribuições (Entradas Mês a Mês)</h3>
                {history.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-foreground/50 border-b border-borders">
                                    <th className="pb-3 px-4 font-medium">Mês</th>
                                    <th className="pb-3 px-4 font-medium">Renda Fixa</th>
                                    <th className="pb-3 px-4 font-medium">Emergência</th>
                                    {(userConfig?.pct_outro || 0) > 0 && <th className="pb-3 px-4 font-medium">{fundos?.outro_nome || 'Outro'}</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-borders">
                                {history.map(h => (
                                    <tr key={h.mes} className="hover:bg-white/[0.02]">
                                        <td className="py-4 px-4 font-semibold text-white">{h.mes}</td>
                                        <td className="py-4 px-4 text-brand-blue">+ R$ {h.fixo.toFixed(2)}</td>
                                        <td className="py-4 px-4 text-brand-yellow">+ R$ {h.emergencia.toFixed(2)}</td>
                                        {(userConfig?.pct_outro || 0) > 0 && <td className="py-4 px-4 text-brand-purple">+ R$ {h.outro.toFixed(2)}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center text-foreground/50 py-4">Nenhum histórico disponível.</div>
                )}
            </div>
        </div>
    );
}
