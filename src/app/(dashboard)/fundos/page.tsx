"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { PiggyBank, ArrowUpRight, ShieldCheck, Wallet, TrendingUp, PlusCircle, X, Trash2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAppStore } from "@/store";

export default function FundosPage() {
    const { user } = useAuth();
    const { userConfig, activeMonth } = useAppStore();
    const [fundos, setFundos] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [carteiras, setCarteiras] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rendaBrutaMes, setRendaBrutaMes] = useState(0);

    useEffect(() => {
        if (user && activeMonth) fetchData();
    }, [user, activeMonth]);

    const fetchData = async () => {
        setLoading(true);
        // Load actual balances
        const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user!.id).single();
        if (f) setFundos(f);

        // Calculate total income for the activeMonth
        const { data: lancamentos } = await supabase
            .from('lancamentos')
            .select('valor, tipo, mes')
            .eq('user_id', user!.id)
            .eq('tipo', 'renda')
            .eq('mes', activeMonth);

        let sumRenda = 0;
        if (lancamentos) {
            lancamentos.forEach(l => sumRenda += l.valor);
        }
        setRendaBrutaMes(sumRenda);

        // Load contribution history
        const { data: h } = await supabase.from('contribuicoes').select('mes, fixo_valor, emergencia_valor, outro_valor, fundo4_valor, fundo5_valor').eq('user_id', user!.id).order('mes', { ascending: true });

        if (h && h.length > 0) {
            // Aggregate by month for the chart and table
            const grouped = Object.values(h.reduce((acc: any, curr: any) => {
                if (!acc[curr.mes]) {
                    acc[curr.mes] = { mes: curr.mes, fixo: 0, emergencia: 0, outro: 0, fundo4: 0, fundo5: 0 };
                }
                acc[curr.mes].fixo += curr.fixo_valor || 0;
                acc[curr.mes].emergencia += curr.emergencia_valor || 0;
                acc[curr.mes].outro += curr.outro_valor || 0;
                acc[curr.mes].fundo4 += curr.fundo4_valor || 0;
                acc[curr.mes].fundo5 += curr.fundo5_valor || 0;
                return acc;
            }, {}));

            setHistory(grouped.reverse()); // Table ordered newest first

            // Chart data ordered oldest first and accumulated
            const sortedGroupes = [...grouped].reverse(); // oldest first
            let accF = 0, accE = 0, accO = 0, acc4 = 0, acc5 = 0;
            const cData = sortedGroupes.map((g: any) => {
                accF += g.fixo;
                accE += g.emergencia;
                accO += g.outro;
                acc4 += g.fundo4;
                acc5 += g.fundo5;
                return {
                    name: g.mes,
                    "Renda Fixa": accF,
                    "Emergência": accE,
                    "Outro": accO,
                    "Fundo4": acc4,
                    "Fundo5": acc5,
                    total: accF + accE + accO + acc4 + acc5
                };
            });
            setChartData(cData);
        }
        setLoading(false);
    };

    if (loading) return <div className="p-8 animate-pulse text-foreground/50">Carregando fundos...</div>;

    const totalAcumulado = (fundos?.fixo_saldo || 0) + (fundos?.emergencia_saldo || 0) + (fundos?.outro_saldo || 0) + (fundos?.fundo4_saldo || 0) + (fundos?.fundo5_saldo || 0);

    const valFixo = userConfig?.pct_fixo || 0;
    const valEmergencia = userConfig?.pct_emergencia || 0;
    const valOutro = userConfig?.pct_outro || 0;
    const valOutro4 = userConfig?.pct_fundo4 || 0;
    const valOutro5 = userConfig?.pct_fundo5 || 0;
    const totalDist = valFixo + valEmergencia + valOutro + valOutro4 + valOutro5;

    const handleRegistrar = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Check if contribution already exists for this month to replace it, or update differences to `fundos` overall balance
            const { data: existingContrib } = await supabase.from('contribuicoes').select('*').eq('user_id', user!.id).eq('mes', activeMonth).maybeSingle();

            const oldFixo = existingContrib?.fixo_valor || 0;
            const oldEmerg = existingContrib?.emergencia_valor || 0;
            const oldOutro = existingContrib?.outro_valor || 0;
            const old4 = existingContrib?.fundo4_valor || 0;
            const old5 = existingContrib?.fundo5_valor || 0;

            const diffFixo = valFixo - oldFixo;
            const diffEmerg = valEmergencia - oldEmerg;
            const diffOutro = valOutro - oldOutro;
            const diff4 = valOutro4 - old4;
            const diff5 = valOutro5 - old5;

            if (existingContrib) {
                await supabase.from('contribuicoes').update({
                    fixo_valor: valFixo,
                    emergencia_valor: valEmergencia,
                    outro_valor: valOutro,
                    fundo4_valor: valOutro4,
                    fundo5_valor: valOutro5,
                }).eq('id', existingContrib.id);
            } else {
                await supabase.from('contribuicoes').insert({
                    user_id: user!.id,
                    mes: activeMonth,
                    fixo_valor: valFixo,
                    emergencia_valor: valEmergencia,
                    outro_valor: valOutro,
                    fundo4_valor: valOutro4,
                    fundo5_valor: valOutro5,
                });
            }

            const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user!.id).single();
            if (f) {
                await supabase.from('fundos').update({
                    fixo_saldo: parseFloat(f.fixo_saldo || "0") + diffFixo,
                    emergencia_saldo: parseFloat(f.emergencia_saldo || "0") + diffEmerg,
                    outro_saldo: parseFloat(f.outro_saldo || "0") + diffOutro,
                    fundo4_saldo: parseFloat(f.fundo4_saldo || "0") + diff4,
                    fundo5_saldo: parseFloat(f.fundo5_saldo || "0") + diff5,
                }).eq('id', f.id);
            }

            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Erro ao registrar distribuição.");
        } finally {
            setSaving(false);
        }
    };

    const handleRefundFund = async (fundKey: string, fundName: string) => {
        if (!confirm(`Deseja APAGAR POR COMPLETO o fundo "${fundName}"? Isso zerará o saldo e removerá o fundo da lista.`)) return;

        setSaving(true);
        try {
            const { data: contribs, error: errC } = await supabase
                .from('contribuicoes')
                .select(`
                    id, 
                    ${fundKey}_valor
                `)
                .eq('user_id', user!.id)
                .gt(`${fundKey}_valor`, 0);

            if (errC) throw errC;

            if (contribs && contribs.length > 0) {
                // Zero out this specific fund in all history
                const contribIds = contribs.map((c: any) => c.id);
                const { error: errU } = await supabase
                    .from('contribuicoes')
                    .update({ [`${fundKey}_valor`]: 0 })
                    .in('id', contribIds);
                if (errU) throw errU;
            }

            // Reset balance in fundos table
            const { data: f } = await supabase.from('fundos').select('id').eq('user_id', user!.id).single();
            if (f) {
                const { error: errF } = await supabase
                    .from('fundos')
                    .update({ [`${fundKey}_saldo`]: 0 })
                    .eq('id', f.id);
                if (errF) throw errF;
            }

            // Remove name and percentage from configuracoes to "hide/delete" the fund
            const { data: conf } = await supabase.from('configuracoes').select('id').eq('user_id', user!.id).single();
            if (conf) {
                const updatePayload: any = {
                    [`pct_${fundKey}`]: 0
                };

                // Clear the name so it completely disappears from the UI
                updatePayload[`${fundKey}_nome`] = null;

                await supabase.from('configuracoes').update(updatePayload).eq('id', conf.id);
            }

            // Note: We don't magically update userConfig here because it's managed by store,
            // we will just reload the page to refresh all states properly or let the user know they might need to refresh.
            // Since useAppStore fetches on app load, window.location.reload() is the safest UX here to reset the global store.

            alert(`Fundo ${fundName} apagado com sucesso! A página será recarregada para aplicar as alterações.`);
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("Erro ao estornar fundo.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteMonth = async (mes: string) => {
        if (!confirm(`Deseja apagar o registro do mês ${mes}? O valor total será estornado dos saldos dos fundos.`)) return;
        setSaving(true);
        try {
            // Find the contribution for this month
            const { data: c } = await supabase
                .from('contribuicoes')
                .select('*')
                .eq('user_id', user!.id)
                .eq('mes', mes)
                .single();

            if (!c) {
                alert("Registro não encontrado.");
                setSaving(false);
                return;
            }

            // Find current fundos balance
            const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user!.id).single();

            if (f) {
                // Subtract the values that were added in this month
                await supabase.from('fundos').update({
                    fixo_saldo: Math.max(0, parseFloat(f.fixo_saldo || "0") - (c.fixo_valor || 0)),
                    emergencia_saldo: Math.max(0, parseFloat(f.emergencia_saldo || "0") - (c.emergencia_valor || 0)),
                    outro_saldo: Math.max(0, parseFloat(f.outro_saldo || "0") - (c.outro_valor || 0)),
                    fundo4_saldo: Math.max(0, parseFloat(f.fundo4_saldo || "0") - (c.fundo4_valor || 0)),
                    fundo5_saldo: Math.max(0, parseFloat(f.fundo5_saldo || "0") - (c.fundo5_valor || 0)),
                }).eq('id', f.id);
            }

            // Delete the contribution record
            await supabase.from('contribuicoes').delete().eq('id', c.id);

            alert(`Registro de ${mes} apagado com sucesso!`);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Erro ao apagar registro do mês.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="pb-6 border-b border-borders flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
                        <PiggyBank className="text-brand-yellow w-6 h-6" /> Fundos Acumulativos
                    </h1>
                    <p className="text-foreground/60 mt-1 mb-4">
                        Seu patrimônio crescendo mês a mês, sem resetar.
                    </p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-green text-background rounded-lg font-bold hover:bg-brand-green/90 transition-colors shadow-lg shadow-brand-green/10"
                    >
                        <PlusCircle className="w-4 h-4" /> Registrar Fundos
                    </button>
                </div>
                <div className="text-right bg-brand-yellow/10 border border-brand-yellow/20 px-4 py-2 rounded-xl">
                    <p className="text-xs text-brand-yellow font-bold uppercase tracking-wider">Total Acumulado</p>
                    <p className="text-xl font-sans font-bold text-brand-yellow">R$ {totalAcumulado.toFixed(2)}</p>
                </div>
            </header>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(!!userConfig?.fixo_nome || (userConfig?.pct_fixo || 0) > 0) && (
                    <div className="bg-cards border border-borders rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-brand-blue/20"></div>
                        <button onClick={() => handleRefundFund('fixo', fundos?.fixo_nome || 'Renda Fixa')} className="absolute top-4 right-4 p-2 text-foreground/40 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors z-10" title="Excluir e Estornar Fundo">
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-3 mb-4 text-brand-blue relative z-0">
                            <TrendingUp className="w-5 h-5" />
                            <span className="font-semibold">{fundos?.fixo_nome || 'Renda Fixa'}</span>
                        </div>
                        <p className="text-3xl font-sans font-bold text-white mb-2">R$ {fundos?.fixo_saldo.toFixed(2)}</p>
                        <div className="flex items-center gap-2 text-sm text-brand-blue">
                            <span className="bg-brand-blue/20 px-2 py-0.5 rounded-full text-xs font-bold">R$ {userConfig?.pct_fixo} por mês</span>
                        </div>
                    </div>
                )}

                {(!!userConfig?.emergencia_nome || (userConfig?.pct_emergencia || 0) > 0) && (
                    <div className="bg-cards border border-borders rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-yellow/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-brand-yellow/20"></div>
                        <button onClick={() => handleRefundFund('emergencia', fundos?.emergencia_nome || 'Emergência')} className="absolute top-4 right-4 p-2 text-foreground/40 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors z-10" title="Excluir e Estornar Fundo">
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-3 mb-4 text-brand-yellow relative z-0">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="font-semibold">{fundos?.emergencia_nome || 'Emergência'}</span>
                        </div>
                        <p className="text-3xl font-sans font-bold text-white mb-2">R$ {fundos?.emergencia_saldo.toFixed(2)}</p>
                        <div className="flex items-center justify-between gap-2 text-sm text-brand-yellow">
                            <span className="bg-brand-yellow/20 px-2 py-0.5 rounded-full text-xs font-bold">R$ {userConfig?.pct_emergencia} por mês</span>
                            <Link
                                href="/fundos/emergencia"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-yellow text-background rounded-lg text-xs font-bold hover:bg-brand-yellow/90 transition-colors shadow-sm"
                                title="Registrar gasto de emergência"
                            >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Usar Fundo
                            </Link>
                        </div>
                    </div>
                )}

                {(!!userConfig?.outro_nome || (userConfig?.pct_outro || 0) > 0) && (
                    <div className="bg-cards border border-borders rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-brand-purple/20"></div>
                        <button onClick={() => handleRefundFund('outro', fundos?.outro_nome || '3º Fundo')} className="absolute top-4 right-4 p-2 text-foreground/40 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors z-10" title="Excluir e Estornar Fundo">
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-3 mb-4 text-brand-purple relative z-0">
                            <Wallet className="w-5 h-5" />
                            <span className="font-semibold">{fundos?.outro_nome || '3º Fundo'}</span>
                        </div>
                        <p className="text-3xl font-sans font-bold text-white mb-2">R$ {fundos?.outro_saldo?.toFixed(2) || "0.00"}</p>
                        <div className="flex items-center gap-2 text-sm text-brand-purple">
                            <span className="bg-brand-purple/20 px-2 py-0.5 rounded-full text-xs font-bold">R$ {userConfig?.pct_outro} por mês</span>
                        </div>
                    </div>
                )}

                {(!!userConfig?.fundo4_nome || (userConfig?.pct_fundo4 || 0) > 0) && (
                    <div className="bg-cards border border-borders rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-brand-green/20"></div>
                        <button onClick={() => handleRefundFund('fundo4', fundos?.fundo4_nome || 'Fundo 4')} className="absolute top-4 right-4 p-2 text-foreground/40 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors z-10" title="Excluir e Estornar Fundo">
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-3 mb-4 text-brand-green relative z-0">
                            <Wallet className="w-5 h-5" />
                            <span className="font-semibold">{fundos?.fundo4_nome || 'Fundo 4'}</span>
                        </div>
                        <p className="text-3xl font-sans font-bold text-white mb-2">R$ {fundos?.fundo4_saldo?.toFixed(2) || "0.00"}</p>
                        <div className="flex items-center gap-2 text-sm text-brand-green">
                            <span className="bg-brand-green/20 px-2 py-0.5 rounded-full text-xs font-bold">R$ {userConfig?.pct_fundo4} por mês</span>
                        </div>
                    </div>
                )}

                {(!!userConfig?.fundo5_nome || (userConfig?.pct_fundo5 || 0) > 0) && (
                    <div className="bg-cards border border-borders rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-red/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-brand-red/20"></div>
                        <button onClick={() => handleRefundFund('fundo5', fundos?.fundo5_nome || 'Fundo 5')} className="absolute top-4 right-4 p-2 text-foreground/40 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors z-10" title="Excluir e Estornar Fundo">
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-3 mb-4 text-brand-red relative z-0">
                            <Wallet className="w-5 h-5" />
                            <span className="font-semibold">{fundos?.fundo5_nome || 'Fundo 5'}</span>
                        </div>
                        <p className="text-3xl font-sans font-bold text-white mb-2">R$ {fundos?.fundo5_saldo?.toFixed(2) || "0.00"}</p>
                        <div className="flex items-center gap-2 text-sm text-brand-red">
                            <span className="bg-brand-red/20 px-2 py-0.5 rounded-full text-xs font-bold">R$ {userConfig?.pct_fundo5} por mês</span>
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
                                    <linearGradient id="colorOut4" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorOut5" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#232b3e" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#161b27', borderColor: '#232b3e', borderRadius: '12px', color: '#fff' }}
                                    itemStyle={{ color: '#e2e8f0', fontSize: '14px' }}
                                />
                                {(!!userConfig?.fixo_nome || (userConfig?.pct_fixo || 0) > 0) && (
                                    <Area type="monotone" dataKey="Renda Fixa" stroke="#4d9fff" fillOpacity={1} fill="url(#colorFixo)" strokeWidth={2} />
                                )}
                                {(!!userConfig?.emergencia_nome || (userConfig?.pct_emergencia || 0) > 0) && (
                                    <Area type="monotone" dataKey="Emergência" stroke="#ffc94d" fillOpacity={1} fill="url(#colorEme)" strokeWidth={2} />
                                )}
                                {(!!userConfig?.outro_nome || (userConfig?.pct_outro || 0) > 0) && (
                                    <Area type="monotone" dataKey="Outro" stroke="#b57bff" fillOpacity={1} fill="url(#colorOut)" strokeWidth={2} />
                                )}
                                {(!!userConfig?.fundo4_nome || (userConfig?.pct_fundo4 || 0) > 0) && (
                                    <Area type="monotone" dataKey="Fundo4" stroke="#10b981" fillOpacity={1} fill="url(#colorOut4)" strokeWidth={2} />
                                )}
                                {(!!userConfig?.fundo5_nome || (userConfig?.pct_fundo5 || 0) > 0) && (
                                    <Area type="monotone" dataKey="Fundo5" stroke="#ef4444" fillOpacity={1} fill="url(#colorOut5)" strokeWidth={2} />
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
                                    {(!!userConfig?.fixo_nome || (userConfig?.pct_fixo || 0) > 0) && <th className="pb-3 px-4 font-medium">{fundos?.fixo_nome || 'Renda Fixa'}</th>}
                                    {(!!userConfig?.emergencia_nome || (userConfig?.pct_emergencia || 0) > 0) && <th className="pb-3 px-4 font-medium">{fundos?.emergencia_nome || 'Emergência'}</th>}
                                    {(!!userConfig?.outro_nome || (userConfig?.pct_outro || 0) > 0) && <th className="pb-3 px-4 font-medium">{fundos?.outro_nome || '3º Fundo'}</th>}
                                    {(!!userConfig?.fundo4_nome || (userConfig?.pct_fundo4 || 0) > 0) && <th className="pb-3 px-4 font-medium">{fundos?.fundo4_nome || 'Fundo 4'}</th>}
                                    {(!!userConfig?.fundo5_nome || (userConfig?.pct_fundo5 || 0) > 0) && <th className="pb-3 px-4 font-medium">{fundos?.fundo5_nome || 'Fundo 5'}</th>}
                                    <th className="pb-3 px-4 font-medium text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-borders">
                                {history.map(h => (
                                    <tr key={h.mes} className="hover:bg-white/[0.02]">
                                        <td className="py-4 px-4 font-semibold text-white">{h.mes}</td>
                                        {(!!userConfig?.fixo_nome || (userConfig?.pct_fixo || 0) > 0) && <td className="py-4 px-4 text-brand-blue">+ R$ {h.fixo.toFixed(2)}</td>}
                                        {(!!userConfig?.emergencia_nome || (userConfig?.pct_emergencia || 0) > 0) && <td className="py-4 px-4 text-brand-yellow">+ R$ {h.emergencia.toFixed(2)}</td>}
                                        {(!!userConfig?.outro_nome || (userConfig?.pct_outro || 0) > 0) && <td className="py-4 px-4 text-brand-purple">+ R$ {h.outro.toFixed(2)}</td>}
                                        {(!!userConfig?.fundo4_nome || (userConfig?.pct_fundo4 || 0) > 0) && <td className="py-4 px-4 text-brand-green">+ R$ {h.fundo4.toFixed(2)}</td>}
                                        {(!!userConfig?.fundo5_nome || (userConfig?.pct_fundo5 || 0) > 0) && <td className="py-4 px-4 text-brand-red">+ R$ {h.fundo5.toFixed(2)}</td>}
                                        <td className="py-4 px-4 text-right">
                                            <button
                                                onClick={() => handleDeleteMonth(h.mes)}
                                                className="p-1.5 text-foreground/40 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors"
                                                title={`Apagar registro de ${h.mes}`}
                                                disabled={saving}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center text-foreground/50 py-4">Nenhum histórico disponível.</div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-cards border border-borders rounded-2xl w-full max-w-lg shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-borders">
                            <h2 className="text-xl font-heading font-bold text-white">
                                Registrar Fundos
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-foreground/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleRegistrar} className="space-y-4">
                                <p className="text-foreground/80 mb-4 bg-white/5 p-4 rounded-xl border border-white/10 text-sm">
                                    Serão utilizados os **valores fixos** definidos nas configurações. Este total será deduzido da <strong>Renda Bruta</strong> de <strong>{activeMonth}</strong> no Dashboard ("Líquido p/ Gastos"), sem criar lançamentos adicionais.
                                </p>

                                <div>
                                    <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Renda Bruta apurada em {activeMonth}</label>
                                    <input type="text" readOnly value={`R$ ${rendaBrutaMes.toFixed(2)}`} className="w-full bg-background border border-borders rounded-lg px-4 py-2.5 text-white opacity-80 cursor-not-allowed" />
                                </div>

                                {rendaBrutaMes > 0 && (
                                    <div className="mt-4 p-4 border border-brand-green/30 bg-brand-green/5 rounded-xl space-y-3">
                                        <div className="flex items-center gap-2 text-brand-green text-sm font-bold">
                                            📊 Prévia da Distribuição
                                        </div>
                                        <div className="space-y-1 text-sm text-foreground/80">
                                            {(!!userConfig?.fixo_nome || (userConfig?.pct_fixo || 0) > 0) && (
                                                <div className="flex justify-between"><span>{userConfig?.fixo_nome || 'Renda Fixa'} (Fixo):</span> <span className="text-white font-medium">+ R$ {valFixo.toFixed(2)}</span></div>
                                            )}
                                            {(!!userConfig?.emergencia_nome || (userConfig?.pct_emergencia || 0) > 0) && (
                                                <div className="flex justify-between"><span>{userConfig?.emergencia_nome || 'Emergência'} (Fixo):</span> <span className="text-white font-medium">+ R$ {valEmergencia.toFixed(2)}</span></div>
                                            )}
                                            {(!!userConfig?.outro_nome || (userConfig?.pct_outro || 0) > 0) && (
                                                <div className="flex justify-between"><span>{userConfig?.outro_nome || `3º Fundo`} (Fixo):</span> <span className="text-white font-medium">+ R$ {valOutro.toFixed(2)}</span></div>
                                            )}
                                            {(!!userConfig?.fundo4_nome || (userConfig?.pct_fundo4 || 0) > 0) && (
                                                <div className="flex justify-between"><span>{userConfig?.fundo4_nome || `Fundo 4`} (Fixo):</span> <span className="text-white font-medium">+ R$ {valOutro4.toFixed(2)}</span></div>
                                            )}
                                            {(!!userConfig?.fundo5_nome || (userConfig?.pct_fundo5 || 0) > 0) && (
                                                <div className="flex justify-between"><span>{userConfig?.fundo5_nome || `Fundo 5`} (Fixo):</span> <span className="text-white font-medium">+ R$ {valOutro5.toFixed(2)}</span></div>
                                            )}
                                            <div className="pt-2 mt-2 border-t border-white/10 flex justify-between font-bold text-brand-red">
                                                <span>Total Debitado da Carteira:</span>
                                                <span>R$ {totalDist.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 flex justify-end">
                                    <button disabled={saving || rendaBrutaMes <= 0} type="submit" className="bg-brand-green text-background px-6 py-2.5 rounded-lg font-bold hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20 disabled:opacity-50">
                                        {saving ? "Registrando..." : "Confirmar"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
