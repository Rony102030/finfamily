"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { useAppStore } from "@/store";

export function SeedManager({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { userConfig, setUserConfig } = useAppStore();
    const [loading, setLoading] = useState(true);
    const inited = useRef(false);

    useEffect(() => {
        if (!user || inited.current) return;
        inited.current = true;

        const initData = async () => {
            const cleanupDups = async () => {
                const { data: categorias } = await supabase.from('categorias').select('id, nome').eq('user_id', user.id).order('created_at', { ascending: true });
                if (categorias) {
                    const seen = new Map();
                    for (const item of categorias) {
                        const nome = item.nome.trim().toLowerCase();
                        if (seen.has(nome)) {
                            const originalId = seen.get(nome);
                            await supabase.from('lancamentos').update({ categoria_id: originalId }).eq('categoria_id', item.id);
                            await supabase.from('categorias').delete().eq('id', item.id);
                        } else seen.set(nome, item.id);
                    }
                }

                const { data: carteiras } = await supabase.from('carteiras').select('id, nome').eq('user_id', user.id).order('created_at', { ascending: true });
                if (carteiras) {
                    const seen = new Map();
                    for (const item of carteiras) {
                        const nome = item.nome.trim().toLowerCase();
                        if (seen.has(nome)) {
                            const originalId = seen.get(nome);
                            await supabase.from('lancamentos').update({ carteira_id: originalId }).eq('carteira_id', item.id);
                            await supabase.from('carteiras').delete().eq('id', item.id);
                        } else seen.set(nome, item.id);
                    }
                }

                const { data: fontes } = await supabase.from('fontes_renda').select('id, nome').eq('user_id', user.id).order('created_at', { ascending: true });
                if (fontes) {
                    const seen = new Map();
                    for (const item of fontes) {
                        const nome = item.nome.trim().toLowerCase();
                        if (seen.has(nome)) {
                            const originalId = seen.get(nome);
                            await supabase.from('lancamentos').update({ fonte_renda_id: originalId }).eq('fonte_renda_id', item.id);
                            await supabase.from('fontes_renda').delete().eq('id', item.id);
                        } else seen.set(nome, item.id);
                    }
                }
            };
            await cleanupDups();

            // Fetch Config
            const { data: configData, error: configErr } = await supabase
                .from('config')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (configErr && configErr.code === 'PGRST116') {
                // Run Seed
                await runSeed(user.id);
            } else if (configData) {
                setUserConfig({
                    pct_fixo: configData.pct_fixo,
                    pct_emergencia: configData.pct_emergencia,
                    pct_outro: configData.pct_outro,
                    outro_nome: configData.outro_nome,
                    seed_done: configData.seed_done
                });
                setLoading(false);
            }
        };

        initData();
    }, [user, setUserConfig]);

    const runSeed = async (userId: string) => {
        try {
            // Configuração inicial
            const { data: config } = await supabase.from('config').insert({
                user_id: userId,
                pct_fixo: 5,
                pct_emergencia: 10,
                pct_outro: 0,
                seed_done: true
            }).select().single();

            if (config) {
                setUserConfig(config);
            }

            // Fundos
            await supabase.from('fundos').insert({ user_id: userId });

            // Carteiras
            await supabase.from('carteiras').insert([
                { user_id: userId, nome: 'PicPay', tipo: 'Banco Digital' },
                { user_id: userId, nome: 'XP', tipo: 'Corretora' },
                { user_id: userId, nome: 'Dinheiro', tipo: 'Espécie' },
                { user_id: userId, nome: 'Outro', tipo: 'Outro' },
            ]);

            // Categorias Base
            const categoriasSeed = [
                { nome: 'Alimentação', icone: '🛒', cor: '#00e5a0' },
                { nome: 'Moradia', icone: '🏠', cor: '#4d9fff' },
                { nome: 'Transporte', icone: '🚗', cor: '#ffc94d' },
                { nome: 'Saúde / Bem-Estar', icone: '💊', cor: '#ff5e7d' },
                { nome: 'Pessoal', icone: '👤', cor: '#b57bff' },
                { nome: 'Lazer', icone: '🎮', cor: '#34d399' },
                { nome: 'Educação', icone: '📚', cor: '#fbbf24' },
                { nome: 'Assinaturas', icone: '📱', cor: '#fb923c' },
                { nome: 'Faturas / Outros', icone: '🧾', cor: '#94a3b8' },
            ];

            await supabase.from('categorias').insert(
                categoriasSeed.map(c => ({ user_id: userId, ...c }))
            );

            // Fontes
            await supabase.from('fontes_renda').insert([
                { user_id: userId, nome: 'Salário' },
                { user_id: userId, nome: 'Bolsa Família' },
                { user_id: userId, nome: 'Freelance' },
                { user_id: userId, nome: 'Low Ticket' },
                { user_id: userId, nome: 'Outro' },
            ]);

            setLoading(false);
        } catch (error) {
            console.error("Seed error", error);
            setLoading(false);
        }
    };

    if (loading && user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background">
                <div className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-foreground/80 font-medium">Preparando seu ambiente...</p>
            </div>
        );
    }

    return <>{children}</>;
}
