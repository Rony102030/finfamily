"use client";

import { useState } from "react";
import { useAppStore } from "@/store";
import { Sparkles, Key, Check } from "lucide-react";

export function IATab() {
    const { anthropicKey, setAnthropicKey } = useAppStore();
    const [key, setKey] = useState(anthropicKey || "");
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setAnthropicKey(key.trim());
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-heading font-bold text-white mb-1 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-brand-purple" /> Inteligência Artificial
                    </h2>
                    <p className="text-sm text-foreground/60">Configure as integrações de IA do AntiGravity.</p>
                </div>
            </div>

            <div className="bg-surface border border-borders rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-brand-purple/10 rounded-xl flex items-center justify-center border border-brand-purple/20">
                        <Key className="w-5 h-5 text-brand-purple" />
                    </div>
                    <div>
                        <h3 className="font-heading font-bold text-white">Chave da API da Anthropic (Claude 3)</h3>
                        <p className="text-xs text-foreground/50">Necessária para o consultor financeiro funcionar.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <input
                        type="password"
                        value={key}
                        onChange={e => setKey(e.target.value)}
                        placeholder="sk-ant-api03-..."
                        className="w-full bg-background border border-borders rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-all"
                    />
                    <div className="flex gap-4 items-center">
                        <button
                            onClick={handleSave}
                            className="bg-brand-purple text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-purple/90 transition-all shadow-lg flex items-center gap-2"
                        >
                            {saved ? <><Check className="w-4 h-4" /> Salvo!</> : 'Salvar Chave'}
                        </button>
                        <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-sm text-brand-purple hover:underline">
                            Obter chave na Anthropic ↗
                        </a>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-borders text-xs text-foreground/50 leading-relaxed">
                    <p>Sua chave é armazenada <strong className="text-foreground/80">apenas localmente no seu navegador</strong> por segurança (Zustand com localStorage). Ela não é salva em nosso banco de dados.</p>
                </div>
            </div>
        </div>
    );
}
