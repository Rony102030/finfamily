"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Caixinhas: dinheiro guardado por objetivo. Saldo = guardar − resgatar + ajustes.
// A de emergência também desconta os lançamentos da categoria Emergência (gastos pagos com a reserva).
// O que é guardado/resgatado no mês sai/volta do "Líquido p/ Gastos" do Dashboard.

export interface Caixinha {
    id: string; nome: string; icone: string; tipo: 'normal' | 'emergencia';
    meta: number | null; prazo: string | null; valor_mensal: number; onde: string | null;
    ordem: number; arquivada: boolean; created_at: string;
}
export interface Movimento {
    id: string; caixinha_id: string; data: string; mes: string;
    tipo: 'guardar' | 'resgatar' | 'ajuste'; valor: number; descricao: string | null; created_at: string;
}
export interface GastoEmergencia {
    id: string; descricao: string; valor: number; data: string; mes: string; status: string;
    group_id: string | null; carteira: string | null;
}

export const isEmergenciaNome = (nome?: string | null) => {
    const n = (nome || "").toLowerCase();
    return n.includes("emergên") || n.includes("emergencia");
};

export function efeitoNoSaldo(m: Pick<Movimento, 'tipo' | 'valor'>) {
    return m.tipo === 'resgatar' ? -m.valor : m.valor;
}

export function saldoCaixinha(c: Caixinha, movimentos: Movimento[], gastos: GastoEmergencia[]) {
    const mov = movimentos.filter(m => m.caixinha_id === c.id).reduce((s, m) => s + efeitoNoSaldo(m), 0);
    const g = c.tipo === 'emergencia' ? gastos.reduce((s, x) => s + x.valor, 0) : 0;
    return Math.round((mov - g) * 100) / 100;
}

/** Guardado líquido no mês (guardar − resgatar), o que sai do "Líquido p/ Gastos". Ajustes não contam. */
export function guardadoNoMes(movimentos: Pick<Movimento, 'mes' | 'tipo' | 'valor'>[], mes: string) {
    return movimentos
        .filter(m => m.mes === mes && m.tipo !== 'ajuste')
        .reduce((s, m) => s + (m.tipo === 'guardar' ? m.valor : -m.valor), 0);
}

export function mesesAte(prazo: string, hoje: string) {
    const [py, pm] = prazo.split("-").map(Number);
    const [hy, hm] = hoje.split("-").map(Number);
    return Math.max(1, (py - hy) * 12 + (pm - hm));
}

export function hojeLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mesesAntes(mes: string, n: number) {
    const [y, m] = mes.split("-").map(Number);
    return Array.from({ length: n }, (_, i) => {
        const d = new Date(y, m - 2 - i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
}

const num = (v: any) => (v === null || v === undefined ? v : Number(v));

export interface DadosCaixinhas {
    caixinhas: Caixinha[];
    movimentos: Movimento[];
    gastos: GastoEmergencia[];
    categoriaEmergenciaId: string | null;
    carteiras: { id: string; nome: string }[];
    mediaDespesas: number;     // média mensal das despesas dos 3 meses anteriores (regra do Dashboard)
    rendaMes: number;          // renda do mês ativo
}

export async function carregarCaixinhas(userId: string, mesAtivo: string): Promise<DadosCaixinhas> {
    const tres = mesesAntes(hojeLocal().slice(0, 7), 3);
    const [cx, mv, cats, cw, desp, renda] = await Promise.all([
        supabase.from('caixinhas').select('*').eq('user_id', userId).order('ordem').order('created_at'),
        supabase.from('caixinha_movimentos').select('*').eq('user_id', userId).order('data', { ascending: false }).order('created_at', { ascending: false }).limit(10000),
        supabase.from('categorias').select('id, nome').eq('user_id', userId).order('created_at'),
        supabase.from('carteiras').select('id, nome').eq('user_id', userId).eq('ativo', true).order('created_at'),
        supabase.from('lancamentos').select('valor, mes, categorias(nome)').eq('user_id', userId).eq('tipo', 'despesa').in('mes', tres),
        supabase.from('lancamentos').select('valor').eq('user_id', userId).eq('tipo', 'renda').eq('mes', mesAtivo),
    ]);
    const erro = [cx, mv, cats].find(r => r.error)?.error;
    if (erro) throw erro;

    let caixinhas = (cx.data || []) as any[];
    if (!caixinhas.some(c => c.tipo === 'emergencia')) {
        // conta nova: toda conta tem a caixinha de emergência
        const { data: nova } = await supabase.from('caixinhas')
            .insert({ user_id: userId, nome: 'Emergência', icone: 'shield', tipo: 'emergencia', ordem: 2 })
            .select('*').single();
        if (nova) caixinhas = [...caixinhas, nova];
        else caixinhas = ((await supabase.from('caixinhas').select('*').eq('user_id', userId).order('ordem')).data || []) as any[];
    }

    const idsEmerg = (cats.data || []).filter(c => isEmergenciaNome(c.nome)).map(c => c.id);
    let gastos: GastoEmergencia[] = [];
    if (idsEmerg.length) {
        const { data } = await supabase.from('lancamentos')
            .select('id, descricao, valor, data, mes, status, group_id, carteiras(nome)')
            .eq('user_id', userId).eq('tipo', 'despesa').in('categoria_id', idsEmerg)
            .order('data', { ascending: false }).limit(5000);
        gastos = (data || []).map((l: any) => ({ ...l, valor: num(l.valor), carteira: l.carteiras?.nome || null }));
    }

    const porMes: Record<string, number> = {};
    for (const l of (desp.data || []) as any[]) {
        const nome = (l.categorias?.nome || "").toLowerCase();
        if (nome === 'fundos' || isEmergenciaNome(nome)) continue;
        porMes[l.mes] = (porMes[l.mes] || 0) + num(l.valor);
    }
    const mesesComDespesa = Object.values(porMes);

    return {
        caixinhas: caixinhas.map(c => ({ ...c, meta: num(c.meta), valor_mensal: num(c.valor_mensal) || 0 })),
        movimentos: ((mv.data || []) as any[]).map(m => ({ ...m, valor: num(m.valor) })),
        gastos,
        categoriaEmergenciaId: idsEmerg[0] || null,
        carteiras: (cw.data || []) as any[],
        mediaDespesas: mesesComDespesa.length ? mesesComDespesa.reduce((s, v) => s + v, 0) / mesesComDespesa.length : 0,
        rendaMes: ((renda.data || []) as any[]).reduce((s, l) => s + num(l.valor), 0),
    };
}

export function useCaixinhas(userId: string | undefined, mesAtivo: string) {
    const [dados, setDados] = useState<DadosCaixinhas | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [carregando, setCarregando] = useState(true);

    const recarregar = useCallback(async () => {
        if (!userId) return;
        try {
            setDados(await carregarCaixinhas(userId, mesAtivo));
            setErro(null);
        } catch (e: any) {
            const semTabela = e?.code === '42P01' || e?.code === 'PGRST205' || /does not exist|schema cache/i.test(e?.message || '');
            setErro(semTabela ? 'SEM_TABELAS' : (e?.message || 'Erro ao carregar'));
        } finally {
            setCarregando(false);
        }
    }, [userId, mesAtivo]);

    useEffect(() => { recarregar(); }, [recarregar]);
    return { dados, erro, carregando, recarregar };
}
