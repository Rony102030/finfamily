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
            // Cleanup duplicates
            const cleanupDups = async () => {
                const { data } = await supabase.from('categorias').select('id, nome').order('created_at', { ascending: true });
                if (data) {
                    const seen = new Set();
                    for (const item of data) {
                        if (seen.has(item.nome)) await supabase.from('categorias').delete().eq('id', item.id);
                        else seen.add(item.nome);
                    }
                }
                const { data: cart } = await supabase.from('carteiras').select('id, nome').order('created_at', { ascending: true });
                if (cart) {
                    const seen = new Set();
                    for (const item of cart) {
                        if (seen.has(item.nome)) await supabase.from('carteiras').delete().eq('id', item.id);
                        else seen.add(item.nome);
                    }
                }
                const { data: font } = await supabase.from('fontes_renda').select('id, nome').order('created_at', { ascending: true });
                if (font) {
                    const seen = new Set();
                    for (const item of font) {
                        if (seen.has(item.nome)) await supabase.from('fontes_renda').delete().eq('id', item.id);
                        else seen.add(item.nome);
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
