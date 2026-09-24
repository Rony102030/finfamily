"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { formatMonth } from "@/lib/format";
import { Briefcase, Edit2, Check, X } from "lucide-react";

import { DashboardTab } from "./tabs/DashboardTab";
import { AnotacoesTab } from "./tabs/AnotacoesTab";
import { useNegociosAcesso } from "@/lib/negocios";
import { NegocioBloqueado } from "@/components/NegocioBloqueado";

type TabType = 'dashboard' | 'anotacoes';

const tabs: { id: TabType; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'anotacoes', label: 'Anotações' },
];

export default function ServicoExtraPage() {
    const { user } = useAuth();
    const modulos = useNegociosAcesso(user?.id);
    if (modulos === null) return <div className="p-8 text-foreground/50 animate-pulse text-center">Carregando...</div>;
    if (!modulos.has('servico_extra')) return <NegocioBloqueado />;
    return <ServicoExtra />;
}

function ServicoExtra() {
    const { user } = useAuth();
    const { userConfig, activeMonth } = useAppStore();

    const [activeTab, setActiveTab] = useState<TabType>('dashboard');

    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState("");

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
            <header className="pb-4 border-b border-borders flex flex-col gap-4">
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
                        Controle isolado do relatório principal — <span className="text-brand-green font-medium">{formatMonth(activeMonth)}</span>
                    </p>
                </div>
            </header>

            {/* Tabs Menu */}
            <div className="flex gap-2 p-1 bg-surface border border-borders rounded-xl overflow-x-auto custom-scrollbar">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                            ? "bg-brand-blue text-background shadow-md shadow-brand-blue/20"
                            : "text-foreground/70 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'dashboard' && <DashboardTab />}
                {activeTab === 'anotacoes' && <AnotacoesTab />}
            </div>
        </div>
    );
}
