// Cálculos da aba Meu Negócio (Hora do Frango). Funções puras sobre os dados já carregados.

export interface FrangoConfig {
    nome: string;
    preco_grande: number;
    preco_padrao: number;
    kg_por_caixa: number;
    meta_mensal: number;
    template_whatsapp: string;
}
export interface CustoFixo { id: string; nome: string; valor: number; ativo: boolean; created_at: string }
export interface Cliente { id: string; nome: string; telefone: string | null }
export interface Compra { id: string; data: string; preco_kg: number; kg_por_caixa: number; caixas: number[]; observacao: string | null; created_at: string }
export interface Custo { id: string; data: string; categoria: string; valor: number; descricao: string | null; fixo_id: string | null; mes: string | null }
export interface Fechamento {
    id: string; data: string; farofa: boolean; assados: number; vend_grande: number; vend_padrao: number;
    preco_grande: number; preco_padrao: number; rec_dinheiro: number; rec_pix: number; rec_cartao: number;
    observacao: string | null; created_at: string;
}
export interface Fiado {
    id: string; cliente_id: string; fechamento_id: string | null; data: string; qtd: number; preco_un: number | null;
    valor: number; status: 'aberto' | 'pago' | 'perdido'; data_baixa: string | null; created_at: string;
}
export interface Recebimento { id: string; fiado_id: string; data: string; valor: number; forma: 'dinheiro' | 'pix' | 'cartao' }

export interface FrangoData {
    config: FrangoConfig;
    fixos: CustoFixo[];
    clientes: Cliente[];
    compras: Compra[];
    custos: Custo[];
    fechamentos: Fechamento[];
    fiados: Fiado[];
    recebimentos: Recebimento[];
}

export const CATEGORIAS_CUSTO = ["Tempero", "Embalagem", "Gás", "Carvão", "Gasolina", "Limpeza", "Energia", "Farofa", "Marketing", "Colaborador", "Outro"];
export const FORMAS = [
    { id: 'dinheiro', label: 'Dinheiro' },
    { id: 'pix', label: 'Pix' },
    { id: 'cartao', label: 'Cartão' },
] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- datas (sempre no fuso local, formato YYYY-MM-DD) ----------

export function hoje(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function mesAtual(): string { return hoje().slice(0, 7); }

function toDate(iso: string) { return new Date(iso + "T12:00:00"); }
export function diasEntre(de: string, ate: string) {
    return Math.round((toDate(ate).getTime() - toDate(de).getTime()) / 86400000);
}
export function somaDias(iso: string, dias: number) {
    const d = toDate(iso);
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Segunda-feira da semana da data. */
export function inicioSemana(iso: string) {
    const dow = toDate(iso).getDay(); // 0 = domingo
    return somaDias(iso, dow === 0 ? -6 : 1 - dow);
}
export function dataCurta(iso: string) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
}
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export function diaSemana(iso: string) { return DIAS[toDate(iso).getDay()]; }

// ---------- fechamento ----------

export function fiadosDoFechamento(d: FrangoData, fechamentoId: string) {
    return d.fiados.filter(f => f.fechamento_id === fechamentoId);
}

export function resumoFechamento(f: Fechamento, fiados: Fiado[]) {
    const fiadoQtd = fiados.reduce((s, x) => s + x.qtd, 0);
    const fiadoValor = fiados.reduce((s, x) => s + x.valor, 0);
    const fiadoGrande = fiados.filter(x => x.preco_un === f.preco_grande).reduce((s, x) => s + x.qtd, 0);
    const vendidos = f.vend_grande + f.vend_padrao + fiadoQtd;
    const totalVendido = f.vend_grande * f.preco_grande + f.vend_padrao * f.preco_padrao + fiadoValor;
    const recebido = f.rec_dinheiro + f.rec_pix + f.rec_cartao;
    return {
        vendidos,
        vendGrandeTotal: f.vend_grande + fiadoGrande,
        sobra: f.assados - vendidos,
        totalVendido: round2(totalVendido),
        recebido: round2(recebido),
        fiadoValor: round2(fiadoValor),
        diferenca: round2(recebido + fiadoValor - totalVendido),
    };
}

// ---------- estoque (FIFO por caixa) ----------

export interface Lote { compraId: string; data: string; frangosNaCaixa: number; custoUn: number; restante: number }
export interface Consumo { frangosNaCaixa: number | null; qtd: number; custoUn: number }

/**
 * Reproduz compras e fechamentos em ordem de data. Cada caixa é um lote; os fechamentos
 * consomem os lotes mais antigos primeiro. Se faltar estoque, o que faltou usa o último
 * custo conhecido e fica marcado como "sem lote".
 */
export function replayEstoque(d: FrangoData, ate?: string) {
    type Ev = { data: string; ordem: number; compra?: Compra; fech?: Fechamento };
    const evs: Ev[] = [
        ...d.compras.map(c => ({ data: c.data, ordem: 0, compra: c })),
        ...d.fechamentos.map(f => ({ data: f.data, ordem: 1, fech: f })),
    ].filter(e => !ate || e.data <= ate)
        .sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem);

    const lotes: Lote[] = [];
    const consumoPorFechamento = new Map<string, { custo: number; faltou: number; consumo: Consumo[] }>();
    let ultimoCusto = 0;

    for (const ev of evs) {
        if (ev.compra) {
            const custoCaixa = ev.compra.preco_kg * ev.compra.kg_por_caixa;
            for (const n of ev.compra.caixas) {
                if (n <= 0) continue;
                const custoUn = custoCaixa / n;
                lotes.push({ compraId: ev.compra.id, data: ev.compra.data, frangosNaCaixa: n, custoUn, restante: n });
                ultimoCusto = custoUn;
            }
        } else if (ev.fech) {
            let precisa = ev.fech.assados;
            let custo = 0;
            const consumo: Consumo[] = [];
            for (const lote of lotes) {
                if (precisa <= 0) break;
                if (lote.restante <= 0) continue;
                const q = Math.min(lote.restante, precisa);
                lote.restante -= q;
                precisa -= q;
                custo += q * lote.custoUn;
                consumo.push({ frangosNaCaixa: lote.frangosNaCaixa, qtd: q, custoUn: lote.custoUn });
            }
            if (precisa > 0) {
                custo += precisa * ultimoCusto;
                consumo.push({ frangosNaCaixa: null, qtd: precisa, custoUn: ultimoCusto });
            }
            consumoPorFechamento.set(ev.fech.id, { custo, faltou: precisa, consumo });
        }
    }

    const restantes = lotes.filter(l => l.restante > 0);
    const unidades = restantes.reduce((s, l) => s + l.restante, 0);
    const valorParado = restantes.reduce((s, l) => s + l.restante * l.custoUn, 0);
    return {
        lotes: restantes,
        unidades,
        valorParado: round2(valorParado),
        custoMedio: unidades > 0 ? valorParado / unidades : ultimoCusto,
        consumoPorFechamento,
    };
}

/** Média de frangos assados por semana, nas últimas N semanas que tiveram fechamento. */
export function mediaAssadosSemana(d: FrangoData, semanas = 4) {
    const porSemana = new Map<string, number>();
    for (const f of d.fechamentos) {
        const s = inicioSemana(f.data);
        porSemana.set(s, (porSemana.get(s) || 0) + f.assados);
    }
    const ultimas = Array.from(porSemana.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, semanas);
    if (ultimas.length === 0) return 0;
    return Math.round(ultimas.reduce((s, [, v]) => s + v, 0) / ultimas.length);
}

export function custoMedioHistorico(d: FrangoData, excetoCompraId?: string) {
    let frangos = 0, total = 0;
    for (const c of d.compras) {
        if (c.id === excetoCompraId) continue;
        const n = c.caixas.reduce((s, x) => s + x, 0);
        frangos += n;
        total += c.preco_kg * c.kg_por_caixa * c.caixas.length;
    }
    return frangos > 0 ? total / frangos : null;
}

// ---------- fiado ----------

export function saldoFiado(d: FrangoData, f: Fiado) {
    const pago = d.recebimentos.filter(r => r.fiado_id === f.id).reduce((s, r) => s + r.valor, 0);
    return round2(Math.max(0, f.valor - pago));
}

export function fiadosAbertos(d: FrangoData, dataRef = hoje()) {
    return d.fiados
        .filter(f => f.status === 'aberto')
        .map(f => ({ ...f, aberto: saldoFiado(d, f), dias: diasEntre(f.data, dataRef) }))
        .filter(f => f.aberto > 0)
        .sort((a, b) => b.dias - a.dias);
}

export function historicoCliente(d: FrangoData, clienteId: string) {
    const fiados = d.fiados.filter(f => f.cliente_id === clienteId);
    const pagos = fiados.filter(f => f.status === 'pago');
    const temposPagamento = pagos.map(f => {
        const recs = d.recebimentos.filter(r => r.fiado_id === f.id);
        const ultimo = recs.reduce((m, r) => (r.data > m ? r.data : m), f.data_baixa || f.data);
        return diasEntre(f.data, ultimo);
    });
    return {
        vezes: fiados.length,
        total: round2(fiados.reduce((s, f) => s + f.valor, 0)),
        aberto: round2(fiados.filter(f => f.status === 'aberto').reduce((s, f) => s + saldoFiado(d, f), 0)),
        perdido: round2(fiados.filter(f => f.status === 'perdido').reduce((s, f) => s + saldoFiado(d, f), 0)),
        tempoMedio: temposPagamento.length ? Math.round(temposPagamento.reduce((s, x) => s + x, 0) / temposPagamento.length) : null,
    };
}

export function linkWhatsApp(template: string, cliente: Cliente, valor: number, data: string) {
    const numero = (cliente.telefone || "").replace(/\D/g, "");
    if (!numero) return null;
    const comDdi = numero.startsWith("55") && numero.length > 11 ? numero : `55${numero}`;
    const texto = template
        .replaceAll("{nome}", cliente.nome)
        .replaceAll("{valor}", formatBRL(valor))
        .replaceAll("{data}", dataCurta(data));
    return `https://wa.me/${comDdi}?text=${encodeURIComponent(texto)}`;
}

export function formatBRL(n: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

// ---------- resultado de um período ----------

/**
 * Resultado de [de, ate] (datas inclusivas), por competência:
 * vendas do dia (inclusive o que ficou fiado) menos o custo dos frangos assados,
 * os outros custos e os fiados dados como perdidos. Recebimento de fiado antigo
 * (sem fechamento) entra como venda na data em que foi recebido.
 */
export function resultadoPeriodo(d: FrangoData, de: string, ate: string, estoque = replayEstoque(d)) {
    const dentro = (x: string) => x >= de && x <= ate;
    const fechs = d.fechamentos.filter(f => dentro(f.data));

    let vendas = 0, vendidos = 0, assados = 0, sobra = 0, custoFrango = 0, consumoCasa = 0;
    let recDinheiro = 0, recPix = 0, recCartao = 0;
    for (const f of fechs) {
        const r = resumoFechamento(f, fiadosDoFechamento(d, f.id));
        const c = estoque.consumoPorFechamento.get(f.id);
        const custoUn = c && f.assados > 0 ? c.custo / f.assados : 0;
        vendas += r.totalVendido;
        vendidos += r.vendidos;
        assados += f.assados;
        sobra += Math.max(0, r.sobra);
        custoFrango += c?.custo || 0;
        consumoCasa += Math.max(0, r.sobra) * custoUn;
        recDinheiro += f.rec_dinheiro;
        recPix += f.rec_pix;
        recCartao += f.rec_cartao;
    }

    const recebimentos = d.recebimentos.filter(r => dentro(r.data));
    const fiadoPorId = new Map(d.fiados.map(f => [f.id, f]));
    let fiadoAntigoRecebido = 0;
    for (const r of recebimentos) {
        if (r.forma === 'dinheiro') recDinheiro += r.valor;
        else if (r.forma === 'pix') recPix += r.valor;
        else recCartao += r.valor;
        if (!fiadoPorId.get(r.fiado_id)?.fechamento_id) fiadoAntigoRecebido += r.valor;
    }

    const perdidos = d.fiados
        .filter(f => f.status === 'perdido' && f.fechamento_id && f.data_baixa && dentro(f.data_baixa))
        .reduce((s, f) => s + saldoFiado(d, f), 0);

    const custos = d.custos.filter(c => dentro(c.data));
    const custosFixos = custos.filter(c => c.fixo_id).reduce((s, c) => s + c.valor, 0);
    const outrosCustos = custos.filter(c => !c.fixo_id).reduce((s, c) => s + c.valor, 0);

    const compras = d.compras.filter(c => dentro(c.data))
        .reduce((s, c) => s + c.preco_kg * c.kg_por_caixa * c.caixas.length, 0);

    const receita = vendas + fiadoAntigoRecebido;
    const lucro = receita - custoFrango - outrosCustos - custosFixos - perdidos;
    const entrou = recDinheiro + recPix + recCartao;

    return {
        fechamentos: fechs.length,
        receita: round2(receita),
        vendidos, assados, sobra,
        custoFrango: round2(custoFrango),
        consumoCasa: round2(consumoCasa),
        outrosCustos: round2(outrosCustos),
        custosFixos: round2(custosFixos),
        perdidos: round2(perdidos),
        lucro: round2(lucro),
        margemPorFrango: vendidos > 0 ? round2(lucro / vendidos) : null,
        caixa: {
            dinheiro: round2(recDinheiro), pix: round2(recPix), cartao: round2(recCartao),
            entrou: round2(entrou),
            saiu: round2(compras + outrosCustos + custosFixos),
        },
    };
}

export function limitesDoMes(mes: string) {
    const [y, m] = mes.split("-").map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    return { de: `${mes}-01`, ate: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

/** Lucro por semana (vendas − frango − outros custos, antes dos fixos), últimas N semanas até a data. */
export function lucroPorSemana(d: FrangoData, ate: string, semanas = 8, estoque = replayEstoque(d)) {
    const fim = inicioSemana(ate);
    const out = [];
    for (let i = semanas - 1; i >= 0; i--) {
        const de = somaDias(fim, -7 * i);
        const r = resultadoPeriodo(d, de, somaDias(de, 6), estoque);
        out.push({
            semana: dataCurta(de),
            lucro: round2(r.lucro + r.custosFixos),
            vendidos: r.vendidos,
        });
    }
    return out;
}

/**
 * Margem de contribuição por frango vendido nos últimos `dias`: preço médio de venda
 * menos custo do frango e dos outros custos (sem os fixos), divididos pelos vendidos.
 */
export function contribuicaoPorFrango(d: FrangoData, ate: string, dias = 60, estoque = replayEstoque(d)) {
    const r = resultadoPeriodo(d, somaDias(ate, -dias + 1), ate, estoque);
    if (r.vendidos === 0) return null;
    return (r.receita - r.custoFrango - r.outrosCustos) / r.vendidos;
}

/** Fixos do mês: os já lançados ou, se ainda não houver, a soma dos fixos ativos. */
export function fixosDoMes(d: FrangoData, mes: string) {
    const lancados = d.custos.filter(c => c.fixo_id && c.mes === mes);
    if (lancados.length) return lancados.reduce((s, c) => s + c.valor, 0);
    return d.fixos.filter(f => f.ativo).reduce((s, f) => s + f.valor, 0);
}

/**
 * Tabela de decisão: margem por caixa, agrupando os fechamentos dos últimos `dias`
 * pelo tipo de caixa de onde saiu a maior parte dos frangos assados (≥ 70%).
 */
export function margemPorTipoDeCaixa(d: FrangoData, ate: string, dias = 60, estoque = replayEstoque(d)) {
    const de = somaDias(ate, -dias + 1);
    const fechs = d.fechamentos.filter(f => f.data >= de && f.data <= ate);

    const periodo = resultadoPeriodo(d, de, ate, estoque);
    const variavelPorFrango = periodo.assados > 0 ? periodo.outrosCustos / periodo.assados : 0;

    const grupos = new Map<number, { fechamentos: number; assados: number; vendidos: number; grande: number; sobra: number; receita: number; custo: number }>();
    for (const f of fechs) {
        const c = estoque.consumoPorFechamento.get(f.id);
        if (!c || f.assados === 0) continue;
        const porTipo = new Map<number, number>();
        for (const x of c.consumo) if (x.frangosNaCaixa) porTipo.set(x.frangosNaCaixa, (porTipo.get(x.frangosNaCaixa) || 0) + x.qtd);
        const dominante = Array.from(porTipo.entries()).sort((a, b) => b[1] - a[1])[0];
        if (!dominante || dominante[1] / f.assados < 0.7) continue;

        const r = resumoFechamento(f, fiadosDoFechamento(d, f.id));
        const g = grupos.get(dominante[0]) || { fechamentos: 0, assados: 0, vendidos: 0, grande: 0, sobra: 0, receita: 0, custo: 0 };
        g.fechamentos += 1;
        g.assados += f.assados;
        g.vendidos += r.vendidos;
        g.grande += r.vendGrandeTotal;
        g.sobra += Math.max(0, r.sobra);
        g.receita += r.totalVendido;
        g.custo += c.custo;
        grupos.set(dominante[0], g);
    }

    return Array.from(grupos.entries()).sort((a, b) => a[0] - b[0]).map(([n, g]) => {
        const custoUn = g.custo / g.assados;
        const precoMedio = g.vendidos > 0 ? g.receita / g.vendidos : 0;
        const taxaSobra = g.sobra / g.assados;
        const margemCaixa = n * ((1 - taxaSobra) * precoMedio - custoUn - variavelPorFrango);
        return {
            frangosNaCaixa: n,
            fechamentos: g.fechamentos,
            custoUn: round2(custoUn),
            pctGrande: g.vendidos > 0 ? g.grande / g.vendidos : 0,
            pctSobra: taxaSobra,
            precoMedio: round2(precoMedio),
            margemCaixa: round2(margemCaixa),
        };
    });
}

/** Média de frangos vendidos em dias com e sem farofa. */
export function efeitoFarofa(d: FrangoData) {
    const media = (lista: Fechamento[]) => lista.length
        ? Math.round(lista.reduce((s, f) => s + resumoFechamento(f, fiadosDoFechamento(d, f.id)).vendidos, 0) / lista.length)
        : null;
    return {
        com: media(d.fechamentos.filter(f => f.farofa)),
        sem: media(d.fechamentos.filter(f => !f.farofa)),
    };
}
