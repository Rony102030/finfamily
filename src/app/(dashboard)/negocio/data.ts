"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FrangoData, FrangoConfig, mesAtual } from "./calc";

export const CONFIG_PADRAO: FrangoConfig = {
    nome: "Hora do Frango",
    preco_grande: 50,
    preco_padrao: 45,
    kg_por_caixa: 20,
    meta_mensal: 160,
    template_whatsapp: "Oi {nome}, ficou {valor} do frango do dia {data}. Pode acertar essa semana?",
};

const num = (v: any) => (v === null || v === undefined ? v : Number(v));

/** Lança os custos fixos ativos no dia 1 do mês (uma vez por fixo e mês). */
async function lancarFixosDoMes(userId: string, mes: string, fixos: any[]) {
    const linhas = fixos
        .filter(f => f.ativo && f.created_at.slice(0, 7) <= mes)
        .map(f => ({ user_id: userId, data: `${mes}-01`, categoria: f.nome, valor: f.valor, fixo_id: f.id, mes }));
    if (!linhas.length) return false;
    const { data } = await supabase.from('frango_custos')
        .upsert(linhas, { onConflict: 'fixo_id,mes', ignoreDuplicates: true })
        .select('id');
    return !!data?.length;
}

async function buscar(userId: string) {
    const tabelas = ['frango_config', 'frango_custos_fixos', 'frango_clientes', 'frango_compras', 'frango_custos', 'frango_fechamentos', 'frango_fiados', 'frango_recebimentos'];
    const res = await Promise.all(tabelas.map(t => {
        let q = supabase.from(t).select('*').eq('user_id', userId);
        if (t !== 'frango_config') q = q.order('created_at', { ascending: true });
        return q.limit(5000);
    }));
    const erro = res.find(r => r.error)?.error;
    if (erro) throw erro;
    return res.map(r => r.data || []);
}

function montarFrangoData(c: any, fixos: any[], clientes: any[], compras: any[], custos: any[], fechamentos: any[], fiados: any[], recebimentos: any[]): FrangoData {
    return {
        config: {
            nome: c.nome, preco_grande: num(c.preco_grande), preco_padrao: num(c.preco_padrao),
            kg_por_caixa: num(c.kg_por_caixa), meta_mensal: num(c.meta_mensal), template_whatsapp: c.template_whatsapp,
        },
        fixos: fixos.map(f => ({ ...f, valor: num(f.valor) })),
        clientes,
        compras: compras.map(x => ({ ...x, preco_kg: num(x.preco_kg), kg_por_caixa: num(x.kg_por_caixa), caixas: (x.caixas || []).map(Number) })),
        custos: custos.map(x => ({ ...x, valor: num(x.valor) })),
        fechamentos: fechamentos.map(x => ({
            ...x,
            preco_grande: num(x.preco_grande), preco_padrao: num(x.preco_padrao),
            rec_dinheiro: num(x.rec_dinheiro), rec_pix: num(x.rec_pix), rec_cartao: num(x.rec_cartao),
        })),
        fiados: fiados.map(x => ({ ...x, valor: num(x.valor), preco_un: num(x.preco_un) })),
        recebimentos: recebimentos.map(x => ({ ...x, valor: num(x.valor) })),
    };
}

/** Só leitura (sem lançar fixos nem criar config): usado pela Retrospectiva. `null` se o módulo não estiver liberado. */
export async function carregarFrangoLeitura(userId: string): Promise<FrangoData | null> {
    const { data: acesso } = await supabase.from('negocios_acesso')
        .select('modulo').eq('user_id', userId).eq('modulo', 'frango').maybeSingle();
    if (!acesso) return null;
    const [cfg, fixos, clientes, compras, custos, fechamentos, fiados, recebimentos] = await buscar(userId);
    return montarFrangoData(cfg[0] || CONFIG_PADRAO, fixos, clientes, compras, custos, fechamentos, fiados, recebimentos);
}

export function useFrangoData(userId: string | undefined) {
    const [data, setData] = useState<FrangoData | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [carregando, setCarregando] = useState(true);

    const recarregar = useCallback(async () => {
        if (!userId) return;
        try {
            const { data: acesso } = await supabase.from('negocios_acesso')
                .select('modulo').eq('user_id', userId).eq('modulo', 'frango').maybeSingle();
            if (!acesso) { setErro('SEM_ACESSO'); return; }

            let [cfg, fixos, clientes, compras, custos, fechamentos, fiados, recebimentos] = await buscar(userId);

            if (!cfg.length) {
                await supabase.from('frango_config').upsert({ user_id: userId, ...CONFIG_PADRAO }, { onConflict: 'user_id', ignoreDuplicates: true });
                cfg = [{ ...CONFIG_PADRAO }];
            }
            if (await lancarFixosDoMes(userId, mesAtual(), fixos)) {
                custos = (await supabase.from('frango_custos').select('*').eq('user_id', userId).order('created_at').limit(5000)).data || custos;
            }

            setData(montarFrangoData(cfg[0], fixos, clientes, compras, custos, fechamentos, fiados, recebimentos));
            setErro(null);
        } catch (e: any) {
            const semTabela = e?.code === '42P01' || e?.code === 'PGRST205' || /does not exist|schema cache/i.test(e?.message || '');
            setErro(semTabela ? 'SEM_TABELAS' : (e?.message || 'Erro ao carregar'));
        } finally {
            setCarregando(false);
        }
    }, [userId]);

    useEffect(() => { recarregar(); }, [recarregar]);

    return { data, erro, carregando, recarregar };
}

/** Busca o cliente pelo nome (sem diferenciar maiúsculas/acentos) ou cria. */
export async function clientePorNome(userId: string, nome: string, clientes: { id: string; nome: string }[]) {
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
    const achado = clientes.find(c => norm(c.nome) === norm(nome));
    if (achado) return achado.id;
    const { data, error } = await supabase.from('frango_clientes').insert({ user_id: userId, nome: nome.trim() }).select('id').single();
    if (error) throw error;
    return data.id as string;
}
