"use client";

// Cache dos dados das telas: mostra na hora o que já foi carregado (memória e aparelho)
// e busca a versão nova por trás. As chaves sempre levam o id do usuário.

const mem = new Map<string, unknown>();
const emAndamento = new Map<string, Promise<unknown>>();
const ultimaChave = new Map<string, string>();
const PREFIXO = "ff-cache:";
const VERSAO = 1;

export function lerCache<T>(chave: string): T | undefined {
    if (mem.has(chave)) return mem.get(chave) as T;
    try {
        const s = localStorage.getItem(PREFIXO + chave);
        if (!s) return undefined;
        const o = JSON.parse(s);
        if (o?.v !== VERSAO) return undefined;
        mem.set(chave, o.d);
        return o.d as T;
    } catch {
        return undefined;
    }
}

function gravar(chave: string, dados: unknown) {
    mem.set(chave, dados);
    const valor = JSON.stringify({ v: VERSAO, t: Date.now(), d: dados });
    try {
        localStorage.setItem(PREFIXO + chave, valor);
    } catch {
        // aparelho sem espaço: apaga o cache antigo e tenta de novo uma vez
        try { limparCacheDoAparelho(); localStorage.setItem(PREFIXO + chave, valor); } catch { }
    }
}

function limparCacheDoAparelho() {
    try {
        for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIXO)) localStorage.removeItem(k);
    } catch { }
}

/** Apaga tudo (ao sair da conta). */
export function limparCache() {
    mem.clear();
    emAndamento.clear();
    limparCacheDoAparelho();
}

/** Busca e guarda. Com `reaproveitar`, um pedido igual já em andamento é usado no lugar de outro. */
export function buscarComCache<T>(chave: string, buscar: () => Promise<T>, reaproveitar = true): Promise<T> {
    const atual = emAndamento.get(chave);
    if (atual && reaproveitar) return atual as Promise<T>;
    const p = buscar()
        .then(d => { gravar(chave, d); return d; })
        .finally(() => { if (emAndamento.get(chave) === p) emAndamento.delete(chave); });
    emAndamento.set(chave, p);
    return p;
}

/**
 * Para as telas: se já tem cache, entrega na hora (`aplicar(dados)`); depois entrega a versão nova.
 * Sem cache, chama `semCache()` antes (para mostrar "carregando").
 * `tela` evita que a resposta de um mês antigo sobrescreva o mês que está na tela.
 */
export async function carregarComCache<T>(tela: string, chave: string, buscar: () => Promise<T>, aplicar: (d: T) => void, semCache?: () => void) {
    ultimaChave.set(tela, chave);
    const c = lerCache<T>(chave);
    if (c !== undefined) aplicar(c);
    else semCache?.();
    // sempre um pedido novo: a tela pode ter acabado de salvar algo
    const novo = await buscarComCache(chave, buscar, false);
    if (ultimaChave.get(tela) === chave) aplicar(novo);
    return novo;
}

/** Pré-carrega em segundo plano, sem atrapalhar a tela atual. */
export function preCarregar(chave: string, buscar: () => Promise<unknown>) {
    if (emAndamento.has(chave)) return;
    buscarComCache(chave, buscar).catch(() => { });
}
