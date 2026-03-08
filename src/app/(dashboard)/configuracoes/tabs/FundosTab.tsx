"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { Plus, Edit2, Check, X, Wallet, Tag, Percent } from "lucide-react";

interface Fundo {
    id: string;
    fixo_saldo: number;
    emergencia_saldo: number;
    outro_saldo: number;
    fundo4_saldo: number;
    fundo5_saldo: number;
}

export function FundosTab() {
    const { user } = useAuth();
    const { userConfig, setUserConfig } = useAppStore();
    const [config, setConfig] = useState<any>(null);
    const [fundo, setFundo] = useState<Fundo | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Forms
    const [pctFixo, setPctFixo] = useState("");
    const [pctEmergencia, setPctEmergencia] = useState("");
    const [pctOutro, setPctOutro] = useState("");
    const [pctFundo4, setPctFundo4] = useState("");
    const [pctFundo5, setPctFundo5] = useState("");

    const [fixoNome, setFixoNome] = useState("");
    const [emergenciaNome, setEmergenciaNome] = useState("");
    const [outroNome, setOutroNome] = useState("");
    const [fundo4Nome, setFundo4Nome] = useState("");
    const [fundo5Nome, setFundo5Nome] = useState("");

    const [visibleFunds, setVisibleFunds] = useState(3);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        const { data: c } = await supabase.from('config').select('*').eq('user_id', user!.id).single();
        const { data: f } = await supabase.from('fundos').select('*').eq('user_id', user!.id).single();
        if (c) {
            setConfig(c);
            setPctFixo(c.pct_fixo?.toString() || "");
            setPctEmergencia(c.pct_emergencia?.toString() || "");
            setPctOutro(c.pct_outro?.toString() || "");
            setPctFundo4(c.pct_fundo4?.toString() || "");
            setPctFundo5(c.pct_fundo5?.toString() || "");

            setFixoNome(c.fixo_nome || "");
            setEmergenciaNome(c.emergencia_nome || "");
            setOutroNome(c.outro_nome || "");
            setFundo4Nome(c.fundo4_nome || "");
            setFundo5Nome(c.fundo5_nome || "");

            // Determine visible funds
            if (c.pct_fundo5 > 0 || c.fundo5_nome) setVisibleFunds(5);
            else if (c.pct_fundo4 > 0 || c.fundo4_nome) setVisibleFunds(4);
            else setVisibleFunds(3);

            // Sync with global store just in case
            setUserConfig(c);
        }
        if (f) setFundo(f);
        setLoading(false);
    };

    const saveConfig = async () => {
        setSaving(true);
        const updates = {
            pct_fixo: parseFloat(pctFixo) || 0,
            pct_emergencia: parseFloat(pctEmergencia) || 0,
            pct_outro: parseFloat(pctOutro) || 0,
            pct_fundo4: parseFloat(pctFundo4) || 0,
            pct_fundo5: parseFloat(pctFundo5) || 0,
            fixo_nome: fixoNome || null,
            emergencia_nome: emergenciaNome || null,
            outro_nome: outroNome || null,
            fundo4_nome: fundo4Nome || null,
            fundo5_nome: fundo5Nome || null
        };

        const { error, data: updatedConfig } = await supabase.from('config').update(updates).eq('user_id', user!.id).select().single();
        if (!error) {
            // Also update fundos name if changed
            await supabase.from('fundos').update({
                fixo_nome: fixoNome || null,
                emergencia_nome: emergenciaNome || null,
                outro_nome: outroNome || null,
                fundo4_nome: fundo4Nome || null,
                fundo5_nome: fundo5Nome || null
            }).eq('user_id', user!.id);

            if (updatedConfig) {
                setUserConfig(updatedConfig);
            }
            alert("Configuração salva com sucesso!");
        } else {
            alert("Erro ao salvar: " + error.message);
        }
        setSaving(false);
    };

    if (loading) return <div className="animate-pulse flex space-y-4 flex-col"><div className="h-10 bg-surface rounded"></div></div>;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-heading font-bold text-white mb-1">Configuração de Fundos</h2>
                <p className="text-sm text-foreground/60 mb-6">
                    Defina a porcentagem de cada fundo que será retida automaticamente de cada renda.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Fixo */}
                    <div className="space-y-3 p-4 bg-surface rounded-xl border border-borders">
                        <div className="flex items-center gap-2 text-brand-blue">
                            <Wallet className="w-5 h-5 flex-shrink-0" />
                            <input
                                placeholder="Nome Fundo 1 (Renda Fixa)"
                                value={fixoNome}
                                onChange={(e) => setFixoNome(e.target.value)}
                                className="font-semibold bg-transparent w-full focus:outline-none text-brand-blue placeholder:text-brand-blue/50"
                            />
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                value={pctFixo}
                                onChange={(e) => setPctFixo(e.target.value)}
                                className="w-full bg-background border border-borders rounded-lg px-4 py-2 text-white pr-8 focus:outline-none focus:border-brand-green"
                            />
                            <Percent className="absolute right-3 top-2.5 w-4 h-4 text-foreground/50" />
                        </div>
                        <div className="text-sm text-foreground/60">
                            Saldo: <span className="text-white font-medium">R$ {fundo?.fixo_saldo.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Emergencia */}
                    <div className="space-y-3 p-4 bg-surface rounded-xl border border-borders">
                        <div className="flex items-center gap-2 text-brand-yellow">
                            <Wallet className="w-5 h-5 flex-shrink-0" />
                            <input
                                placeholder="Nome Fundo 2 (Emergência)"
                                value={emergenciaNome}
                                onChange={(e) => setEmergenciaNome(e.target.value)}
                                className="font-semibold bg-transparent w-full focus:outline-none text-brand-yellow placeholder:text-brand-yellow/50"
                            />
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                value={pctEmergencia}
                                onChange={(e) => setPctEmergencia(e.target.value)}
                                className="w-full bg-background border border-borders rounded-lg px-4 py-2 text-white pr-8 focus:outline-none focus:border-brand-green"
                            />
                            <Percent className="absolute right-3 top-2.5 w-4 h-4 text-foreground/50" />
                        </div>
                        <div className="text-sm text-foreground/60">
                            Saldo: <span className="text-white font-medium">R$ {fundo?.emergencia_saldo.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Outro */}
                    <div className="space-y-3 p-4 bg-surface rounded-xl border border-borders">
                        <div className="flex items-center gap-2 text-brand-purple">
                            <Wallet className="w-5 h-5 flex-shrink-0" />
                            <input
                                placeholder="Nome Fundo 3"
                                value={outroNome}
                                onChange={(e) => setOutroNome(e.target.value)}
                                className="font-semibold bg-transparent w-full focus:outline-none text-brand-purple placeholder:text-brand-purple/50"
                            />
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                value={pctOutro}
                                onChange={(e) => setPctOutro(e.target.value)}
                                className="w-full bg-background border border-borders rounded-lg px-4 py-2 text-white pr-8 focus:outline-none focus:border-brand-green"
                            />
                            <Percent className="absolute right-3 top-2.5 w-4 h-4 text-foreground/50" />
                        </div>
                        <div className="text-sm text-foreground/60">
                            Saldo: <span className="text-white font-medium">R$ {fundo?.outro_saldo?.toFixed(2) || "0.00"}</span>
                        </div>
                    </div>

                    {/* Fundo 4 */}
                    {visibleFunds >= 4 && (
                        <div className="space-y-3 p-4 bg-surface rounded-xl border border-borders animate-in fade-in zoom-in duration-300">
                            <div className="flex items-center gap-2 text-brand-green">
                                <Wallet className="w-5 h-5 flex-shrink-0" />
                                <input
                                    placeholder="Nome Fundo 4"
                                    value={fundo4Nome}
                                    onChange={(e) => setFundo4Nome(e.target.value)}
                                    className="font-semibold bg-transparent w-full focus:outline-none text-brand-green placeholder:text-brand-green/50"
                                />
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={pctFundo4}
                                    onChange={(e) => setPctFundo4(e.target.value)}
                                    className="w-full bg-background border border-borders rounded-lg px-4 py-2 text-white pr-8 focus:outline-none focus:border-brand-green"
                                />
                                <Percent className="absolute right-3 top-2.5 w-4 h-4 text-foreground/50" />
                            </div>
                            <div className="text-sm text-foreground/60">
                                Saldo: <span className="text-white font-medium">R$ {fundo?.fundo4_saldo?.toFixed(2) || "0.00"}</span>
                            </div>
                        </div>
                    )}

                    {/* Fundo 5 */}
                    {visibleFunds >= 5 && (
                        <div className="space-y-3 p-4 bg-surface rounded-xl border border-borders animate-in fade-in zoom-in duration-300">
                            <div className="flex items-center gap-2 text-brand-red">
                                <Wallet className="w-5 h-5 flex-shrink-0" />
                                <input
                                    placeholder="Nome Fundo 5"
                                    value={fundo5Nome}
                                    onChange={(e) => setFundo5Nome(e.target.value)}
                                    className="font-semibold bg-transparent w-full focus:outline-none text-brand-red placeholder:text-brand-red/50"
                                />
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={pctFundo5}
                                    onChange={(e) => setPctFundo5(e.target.value)}
                                    className="w-full bg-background border border-borders rounded-lg px-4 py-2 text-white pr-8 focus:outline-none focus:border-brand-green"
                                />
                                <Percent className="absolute right-3 top-2.5 w-4 h-4 text-foreground/50" />
                            </div>
                            <div className="text-sm text-foreground/60">
                                Saldo: <span className="text-white font-medium">R$ {fundo?.fundo5_saldo?.toFixed(2) || "0.00"}</span>
                            </div>
                        </div>
                    )}

                    {/* Adicionar Novo Fundo */}
                    {visibleFunds < 5 && (
                        <button
                            onClick={() => setVisibleFunds(v => v + 1)}
                            className="flex items-center justify-center gap-2 p-4 bg-background border border-dashed border-borders hover:border-brand-green/50 hover:bg-brand-green/5 rounded-xl text-foreground/60 hover:text-brand-green transition-all"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="font-bold text-sm">Adicionar Fundo</span>
                        </button>
                    )}
                </div>

                {(() => {
                    const totalPct = (parseFloat(pctFixo) || 0) + (parseFloat(pctEmergencia) || 0) + (parseFloat(pctOutro) || 0) + (parseFloat(pctFundo4) || 0) + (parseFloat(pctFundo5) || 0);
                    return (
                        <div className="mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="space-y-2">
                                <div className={`text-sm ${totalPct > 100 ? 'text-brand-red font-bold' : 'text-foreground/50'}`}>
                                    Total alocado: {totalPct}%
                                </div>
                                <div className="text-xs text-brand-yellow/80 bg-brand-yellow/10 p-2 rounded-lg border border-brand-yellow/20 max-w-lg">
                                    💡 <strong>Lembrete:</strong> Ao alterar a porcentagem dos fundos, a modificação passa a valer para os próximos lançamentos. Lançamentos feitos no passado não terão as transferências para os fundos alteradas.
                                </div>
                            </div>
                            <button
                                onClick={saveConfig}
                                disabled={saving || totalPct > 100}
                                className="bg-brand-green text-background px-6 py-2 rounded-lg font-bold hover:bg-brand-green/90 transition-all disabled:opacity-50 whitespace-nowrap"
                            >
                                {saving ? "Salvando..." : "Salvar Configurações"}
                            </button>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
