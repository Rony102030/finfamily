"use client";

import { useState } from "react";
import { Calculator, Percent, TrendingUp, RefreshCcw } from "lucide-react";
import { useAppStore } from "@/store";

export default function CalculadoraPage() {
    const { userConfig } = useAppStore();
    const [activeTab, setActiveTab] = useState<'divisao' | 'juros'>('divisao');

    // Estado Divisão de Renda
    const [rendaSimulada, setRendaSimulada] = useState("");

    // Estado Juros Compostos
    const [capitalInicial, setCapitalInicial] = useState("");
    const [aporteMensal, setAporteMensal] = useState("");
    const [taxaAnual, setTaxaAnual] = useState("");
    const [periodoAnos, setPeriodoAnos] = useState("");

    const [resJuros, setResJuros] = useState<{ total: number, investido: number, juros: number } | null>(null);

    const calcDivisao = () => {
        const val = parseFloat(rendaSimulada) || 0;
        const fixo = val * ((userConfig?.pct_fixo || 0) / 100);
        const eme = val * ((userConfig?.pct_emergencia || 0) / 100);
        const out = val * ((userConfig?.pct_outro || 0) / 100);
        const out4 = val * ((userConfig?.pct_fundo4 || 0) / 100);
        const out5 = val * ((userConfig?.pct_fundo5 || 0) / 100);
        const livre = val - fixo - eme - out - out4 - out5;
        return { fixo, eme, out, out4, out5, livre };
    };

    const calcJuros = () => {
        const p = parseFloat(capitalInicial) || 0;
        const pmt = parseFloat(aporteMensal) || 0;
        const r = parseFloat(taxaAnual) || 0;
        const t = parseFloat(periodoAnos) || 0;

        if (r === 0 && t === 0) return;

        const i = r / 100 / 12; // taxa mensal
        const n = t * 12; // meses totais

        const m = p * Math.pow(1 + i, n) + pmt * ((Math.pow(1 + i, n) - 1) / i);
        const investido = p + (pmt * n);
        const juros = m - investido;

        setResJuros({ total: m, investido, juros });
    };

    const div = calcDivisao();

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
            <header className="pb-6 border-b border-borders text-center">
                <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4 border border-borders shadow-lg shadow-black/20">
                    <Calculator className="text-brand-purple w-8 h-8" />
                </div>
                <h1 className="text-2xl font-heading font-bold text-white tracking-tight">
                    Calculadoras Financeiras
                </h1>
                <p className="text-foreground/60 mt-2">
                    Simule cenários e planeje seu futuro.
                </p>
            </header>

            <div className="flex bg-surface rounded-xl p-1 mb-6 border border-borders relative">
                <button
                    onClick={() => setActiveTab('divisao')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'divisao' ? 'bg-brand-purple text-white shadow-md' : 'text-foreground/60 hover:text-white'}`}
                >
                    Divisão Automática de Renda
                </button>
                <button
                    onClick={() => setActiveTab('juros')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'juros' ? 'bg-brand-green text-background shadow-md' : 'text-foreground/60 hover:text-white'}`}
                >
                    Juros Compostos
                </button>
            </div>

            {activeTab === 'divisao' && (
                <div className="bg-cards border border-borders rounded-2xl p-6 md:p-8">
                    <div className="flex items-center justify-center mb-8">
                        <div className="text-center w-full max-w-sm">
                            <label className="block text-sm font-bold text-foreground/80 mb-2 uppercase tracking-wider">Simular Renda Líquida Mensal (R$)</label>
                            <input
                                type="number"
                                value={rendaSimulada}
                                onChange={(e) => setRendaSimulada(e.target.value)}
                                placeholder="0,00"
                                className="w-full text-center text-4xl font-sans font-bold bg-background border border-borders rounded-xl p-4 text-white focus:outline-none focus:border-brand-purple"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-xl p-4 text-center flex flex-col items-center justify-center">
                            <span className="text-xs font-bold text-brand-blue uppercase mb-1">{userConfig?.pct_fixo}% {userConfig?.fixo_nome || 'Renda Fixa'}</span>
                            <span className="text-xl font-sans font-bold text-white">R$ {div.fixo.toFixed(2)}</span>
                        </div>
                        <div className="bg-brand-yellow/10 border border-brand-yellow/20 rounded-xl p-4 text-center flex flex-col items-center justify-center">
                            <span className="text-xs font-bold text-brand-yellow uppercase mb-1">{userConfig?.pct_emergencia}% {userConfig?.emergencia_nome || 'Emergência'}</span>
                            <span className="text-xl font-sans font-bold text-white">R$ {div.eme.toFixed(2)}</span>
                        </div>
                        {(userConfig?.pct_outro || 0) > 0 && (
                            <div className="bg-brand-purple/10 border border-brand-purple/20 rounded-xl p-4 text-center flex flex-col items-center justify-center">
                                <span className="text-xs font-bold text-brand-purple uppercase mb-1">{userConfig?.pct_outro}% {userConfig?.outro_nome || '3º Fundo'}</span>
                                <span className="text-xl font-sans font-bold text-white">R$ {div.out.toFixed(2)}</span>
                            </div>
                        )}
                        {(userConfig?.pct_fundo4 || 0) > 0 && (
                            <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-4 text-center flex flex-col items-center justify-center">
                                <span className="text-xs font-bold text-brand-green uppercase mb-1">{userConfig?.pct_fundo4}% {userConfig?.fundo4_nome || 'Fundo 4'}</span>
                                <span className="text-xl font-sans font-bold text-white">R$ {div.out4.toFixed(2)}</span>
                            </div>
                        )}
                        {(userConfig?.pct_fundo5 || 0) > 0 && (
                            <div className="bg-brand-red/10 border border-brand-red/20 rounded-xl p-4 text-center flex flex-col items-center justify-center">
                                <span className="text-xs font-bold text-brand-red uppercase mb-1">{userConfig?.pct_fundo5}% {userConfig?.fundo5_nome || 'Fundo 5'}</span>
                                <span className="text-xl font-sans font-bold text-white">R$ {div.out5.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="bg-surface/50 border border-borders rounded-xl p-4 text-center flex flex-col items-center justify-center">
                            <span className="text-xs font-bold text-foreground/80 uppercase mb-1">Livre p/ Gastos</span>
                            <span className="text-xl font-sans font-bold text-brand-green">R$ {div.livre.toFixed(2)}</span>
                        </div>
                    </div>
                    <p className="text-center text-xs text-foreground/50 mt-6 bg-surface/50 border border-borders p-3 rounded-lg max-w-lg mx-auto">
                        A divisão é baseada nas porcentagens de seus Fundos configuradas nas <span className="text-white">Configurações</span>.
                    </p>
                </div>
            )}

            {activeTab === 'juros' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-cards border border-borders rounded-2xl p-6 order-2 md:order-1">
                        <h3 className="font-heading font-bold text-white mb-6 text-lg">Parâmetros</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-foreground/80 mb-2">Capital Inicial (R$)</label>
                                <input type="number" value={capitalInicial} onChange={e => setCapitalInicial(e.target.value)} placeholder="0" className="w-full bg-background border border-borders rounded-xl px-4 py-3 text-white focus:border-brand-green" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-foreground/80 mb-2">Aporte Mensal (R$)</label>
                                <input type="number" value={aporteMensal} onChange={e => setAporteMensal(e.target.value)} placeholder="0" className="w-full bg-background border border-borders rounded-xl px-4 py-3 text-white focus:border-brand-green" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-foreground/80 mb-2">Taxa de Juros Anual (%)</label>
                                <input type="number" value={taxaAnual} onChange={e => setTaxaAnual(e.target.value)} placeholder="10" className="w-full bg-background border border-borders rounded-xl px-4 py-3 text-white focus:border-brand-green" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-foreground/80 mb-2">Período (Anos)</label>
                                <input type="number" value={periodoAnos} onChange={e => setPeriodoAnos(e.target.value)} placeholder="5" className="w-full bg-background border border-borders rounded-xl px-4 py-3 text-white focus:border-brand-green" />
                            </div>
                            <button
                                onClick={calcJuros}
                                className="w-full bg-brand-green text-background py-3 font-bold rounded-xl hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20 mt-4 flex items-center justify-center gap-2"
                            >
                                <TrendingUp className="w-5 h-5" /> Calcular
                            </button>
                        </div>
                    </div>

                    <div className="bg-cards border border-borders rounded-2xl p-6 border-brand-green/30 relative overflow-hidden order-1 md:order-2">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-green via-brand-blue to-brand-purple"></div>
                        <h3 className="font-heading font-bold text-white mb-6 text-lg">Projeção Final</h3>

                        {resJuros ? (
                            <div className="space-y-6">
                                <div className="text-center mb-8">
                                    <p className="text-sm font-bold text-foreground/60 uppercase tracking-widest mb-1">Valor Total Final</p>
                                    <p className="text-5xl font-sans font-bold text-brand-green">R$ {resJuros.total.toFixed(2)}</p>
                                </div>
                                <div className="bg-surface rounded-xl p-4 border border-borders divide-y divide-borders">
                                    <div className="flex justify-between py-3">
                                        <span className="text-foreground/80">Total Investido:</span>
                                        <span className="font-bold text-white">R$ {resJuros.investido.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between py-3">
                                        <span className="text-foreground/80">Juros Acumulados:</span>
                                        <span className="font-bold text-brand-blue">+ R$ {resJuros.juros.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-48 flex items-center justify-center text-center text-foreground/50 border border-dashed border-borders rounded-xl">
                                Preencha os parâmetros e clique em calcular para ver a mágica dos juros compostos.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
