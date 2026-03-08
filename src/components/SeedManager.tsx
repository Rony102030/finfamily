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
                    pct_fundo4: configData.pct_fundo4 || 0,
                    pct_fundo5: configData.pct_fundo5 || 0,
                    fixo_nome: configData.fixo_nome || null,
                    emergencia_nome: configData.emergencia_nome || null,
                    outro_nome: configData.outro_nome || null,
                    fundo4_nome: configData.fundo4_nome || null,
                    fundo5_nome: configData.fundo5_nome || null,
                    servico_extra_nome: configData.servico_extra_nome,
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
                servico_extra_nome: 'Serviço Extra',
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
                { nome: 'Fundos', icone: '🐷', cor: '#4d9fff' },
            ];

            const { data: insertedCats } = await supabase.from('categorias').insert(
                categoriasSeed.map(c => ({ user_id: userId, ...c }))
            ).select();

            if (insertedCats) {
                const fundosCat = insertedCats.find(c => c.nome === 'Fundos');
                if (fundosCat) {
                    await supabase.from('subcategorias').insert([
                        { user_id: userId, categoria_id: fundosCat.id, nome: 'Renda Fixa' },
                        { user_id: userId, categoria_id: fundosCat.id, nome: 'Emergência' }
                    ]);
                }
            }

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
