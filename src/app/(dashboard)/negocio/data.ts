"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { carregarComCache } from "@/lib/cache";
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

/** Perdas no estoque. `null` quando a tabela ainda não foi criada (migration_frango_perdas.sql). */
async function buscarPerdas(userId: string) {
    const { data, error } = await supabase.from('frango_perdas').select('*').eq('user_id', userId).order('data').limit(5000);
    if (error) return null;
    return (data || []).map((p: any) => ({ ...p, qtd: Number(p.qtd) }));
}

/** Venda de frango cru e conta com o dono. `null` quando migration_melhorias_outubro.sql ainda não foi rodada. */
async function buscarExtras(userId: string) {
    const [cru, dono] = await Promise.all([
        supabase.from('frango_vendas_cru').select('*').eq('user_id', userId).order('data').limit(5000),
        supabase.from('frango_conta_dono').select('*').eq('user_id', userId).order('data').limit(5000),
    ]);
    if (cru.error || dono.error) return null;
    return {
        vendasCru: (cru.data || []).map((v: any) => ({ ...v, qtd: Number(v.qtd), preco_un: num(v.preco_un) })),
        contaDono: (dono.data || []).map((m: any) => ({ ...m, valor: num(m.valor) })),
    };
}
type Extras = Awaited<ReturnType<typeof buscarExtras>>;

function montarFrangoData(c: any, fixos: any[], clientes: any[], compras: any[], custos: any[], fechamentos: any[], fiados: any[], recebimentos: any[], perdas: any[] | null = [], extras: Extras = null): FrangoData {
    return {
        config: {
            nome: c.nome, preco_grande: num(c.preco_grande), preco_padrao: num(c.preco_padrao),
            kg_por_caixa: num(c.kg_por_caixa), meta_mensal: num(c.meta_mensal), template_whatsapp: c.template_whatsapp,
            caixa_data: c.caixa_data || null, caixa_dinheiro: num(c.caixa_dinheiro) || 0, caixa_pix: num(c.caixa_pix) || 0,
        },
        fixos: fixos.map(f => ({ ...f, valor: num(f.valor) })),
        clientes,
        compras: compras.map(x => ({ ...x, preco_kg: num(x.preco_kg), kg_por_caixa: num(x.kg_por_caixa), caixas: (x.caixas || []).map(Number) })),
        custos: custos.map(x => ({ ...x, valor: num(x.valor) })),
        fechamentos: fechamentos.map(x => ({
            ...x,
            preco_grande: num(x.preco_grande), preco_padrao: num(x.preco_padrao),
            rec_dinheiro: num(x.rec_dinheiro), rec_pix: num(x.rec_pix), rec_cartao: num(x.rec_cartao),
            vendas_outras: (x.vendas_outras || []).map((v: any) => ({ qtd: Number(v.qtd), preco: Number(v.preco) })),
            procura_nao_atendida: Number(x.procura_nao_atendida || 0),
        })),
        fiados: fiados.map(x => ({ ...x, valor: num(x.valor), preco_un: num(x.preco_un) })),
        recebimentos: recebimentos.map(x => ({ ...x, valor: num(x.valor) })),
        perdas: perdas || [],
        perdasIndisponivel: perdas === null,
        vendasCru: extras?.vendasCru || [],
        contaDono: extras?.contaDono || [],
        melhoriasIndisponivel: extras === null,
    };
}

/** Só leitura (sem lançar fixos nem criar config): usado pela Retrospectiva. `null` se o módulo não estiver liberado. */
export async function carregarFrangoLeitura(userId: string): Promise<FrangoData | null> {
    const { data: acesso } = await supabase.from('negocios_acesso')
        .select('modulo').eq('user_id', userId).eq('modulo', 'frango').maybeSingle();
    if (!acesso) return null;
    const [[cfg, fixos, clientes, compras, custos, fechamentos, fiados, recebimentos], perdas, extras] = await Promise.all([buscar(userId), buscarPerdas(userId), buscarExtras(userId)]);
    return montarFrangoData(cfg[0] || CONFIG_PADRAO, fixos, clientes, compras, custos, fechamentos, fiados, recebimentos, perdas, extras);
}

/** Carrega tudo para a tela (cria a config e lança os fixos do mês, se faltar). */
async function buscarTudo(userId: string): Promise<FrangoData | 'SEM_ACESSO'> {
    const { data: acesso } = await supabase.from('negocios_acesso')
        .select('modulo').eq('user_id', userId).eq('modulo', 'frango').maybeSingle();
    if (!acesso) return 'SEM_ACESSO';

    let [[cfg, fixos, clientes, compras, custos, fechamentos, fiados, recebimentos], perdas, extras] = await Promise.all([buscar(userId), buscarPerdas(userId), buscarExtras(userId)]);

    if (!cfg.length) {
        await supabase.from('frango_config').upsert({ user_id: userId, ...CONFIG_PADRAO }, { onConflict: 'user_id', ignoreDuplicates: true });
        cfg = [{ ...CONFIG_PADRAO }];
    }
    if (await lancarFixosDoMes(userId, mesAtual(), fixos)) {
        custos = (await supabase.from('frango_custos').select('*').eq('user_id', userId).order('created_at').limit(5000)).data || custos;
    }
    return montarFrangoData(cfg[0], fixos, clientes, compras, custos, fechamentos, fiados, recebimentos, perdas, extras);
}

export function useFrangoData(userId: string | undefined) {
    const [data, setData] = useState<FrangoData | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [carregando, setCarregando] = useState(true);

    const recarregar = useCallback(async () => {
        if (!userId) return;
        try {
            // mostra na hora o que já estava guardado e atualiza por trás
            await carregarComCache('frango', `frango:${userId}`, () => buscarTudo(userId), r => {
                if (r === 'SEM_ACESSO') setErro('SEM_ACESSO');
                else { setData(r); setErro(null); }
                setCarregando(false);
            });
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
