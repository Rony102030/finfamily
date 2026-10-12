"use client";

// Buscas das telas principais, em um lugar só: as telas usam e o menu pré-carrega (cache.ts).
import { supabase } from "@/lib/supabaseClient";
import { carregarCaixinhas } from "@/lib/caixinhas";
import { preCarregar } from "@/lib/cache";

export function mesDeslocado(mes: string, delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const numerar = (rows: any[] | null) => (rows || []).map(r => ({ ...r, valor: Number(r.valor) }));

export const chaveDashboard = (userId: string, mes: string) => `dash:${userId}:${mes}`;
export async function buscarDashboard(userId: string, mes: string) {
    const prev = mesDeslocado(mes, -1);
    const last6 = Array.from({ length: 6 }, (_, i) => mesDeslocado(mes, i - 5));
    const [atual, anterior, tendencia, cx] = await Promise.all([
        supabase.from('lancamentos').select('*, categorias(nome, cor, limite_mensal)').eq('user_id', userId).eq('mes', mes),
        supabase.from('lancamentos').select('*, categorias(nome)').eq('user_id', userId).eq('mes', prev),
        supabase.from('lancamentos').select('mes, tipo, valor, categorias(nome)').eq('user_id', userId).in('mes', last6),
        carregarCaixinhas(userId, mes).catch(() => null),
    ]);
    const erro = [atual, anterior, tendencia].find(r => r.error)?.error;
    if (erro) throw erro;
    return { txs: numerar(atual.data), prevTxs: numerar(anterior.data), trendTxs: numerar(tendencia.data), caixinhas: cx };
}

export const chaveLancamentos = (userId: string, mes: string) => `lanc:${userId}:${mes}`;
export async function buscarLancamentos(userId: string, mes: string) {
    const [lanc, mov] = await Promise.all([
        supabase.from('lancamentos')
            .select('*, categorias ( nome, icone, cor ), subcategorias ( nome ), carteiras ( nome ), fontes_renda ( nome )')
            .eq('user_id', userId).eq('mes', mes)
            .order('data', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('caixinha_movimentos').select('mes, tipo, valor').eq('user_id', userId).eq('mes', mes),
    ]);
    if (lanc.error) throw lanc.error;
    return { lancamentos: numerar(lanc.data), movimentos: numerar(mov.data) };
}

export const chaveCaixinhas = (userId: string, mes: string) => `cx:${userId}:${mes}`;

/** Pré-carrega as telas principais do mês (chamado pelo layout quando o app fica parado). */
export function preCarregarTelas(userId: string, mes: string) {
    preCarregar(chaveDashboard(userId, mes), () => buscarDashboard(userId, mes));
    preCarregar(chaveLancamentos(userId, mes), () => buscarLancamentos(userId, mes));
    preCarregar(chaveCaixinhas(userId, mes), () => carregarCaixinhas(userId, mes));
}
