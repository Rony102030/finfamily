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
    const [outroNome, setOutroNome] = useState("");

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
            setPctFixo(c.pct_fixo.toString());
            setPctEmergencia(c.pct_emergencia.toString());
            setPctOutro(c.pct_outro.toString());
            setOutroNome(c.outro_nome || "");

            // Sync with global store just in case
            if (userConfig?.pct_fixo !== c.pct_fixo || userConfig?.pct_emergencia !== c.pct_emergencia) {
                setUserConfig(c);
            }
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
            outro_nome: outroNome || null
        };

        const { error, data: updatedConfig } = await supabase.from('config').update(updates).eq('user_id', user!.id).select().single();
        if (!error) {
            // Also update fundos name if changed
            await supabase.from('fundos').update({ outro_nome: outroNome || null }).eq('user_id', user!.id);

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
                            <Wallet className="w-5 h-5" />
                            <span className="font-semibold">Renda Fixa</span>
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
                            <Wallet className="w-5 h-5" />
                            <span className="font-semibold">Emergência</span>
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
                            <Wallet className="w-5 h-5" />
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
                            Saldo: <span className="text-white font-medium">R$ {fundo?.outro_saldo.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                    <div className={`text-sm ${(parseFloat(pctFixo || "0") + parseFloat(pctEmergencia || "0") + parseFloat(pctOutro || "0")) > 100 ? 'text-brand-red' : 'text-foreground/50'}`}>
                        Total alocado: {(parseFloat(pctFixo || "0") + parseFloat(pctEmergencia || "0") + parseFloat(pctOutro || "0"))}%
                    </div>
                    <button
                        onClick={saveConfig}
                        disabled={saving || (parseFloat(pctFixo || "0") + parseFloat(pctEmergencia || "0") + parseFloat(pctOutro || "0")) > 100}
                        className="bg-brand-green text-background px-6 py-2 rounded-lg font-bold hover:bg-brand-green/90 transition-all disabled:opacity-50"
                    >
                        {saving ? "Salvando..." : "Salvar Configurações"}
                    </button>
                </div>
            </div>
        </div>
    );
}
