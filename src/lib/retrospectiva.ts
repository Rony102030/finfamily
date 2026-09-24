// Retrospectiva do mês: tudo calculado a partir dos dados que já existem (lançamentos, caixinhas, frango).
// Mesma regra do Dashboard: a categoria antiga "Fundos" e os gastos pagos com a reserva (Emergência) não são despesa do mês.
import { DadosCaixinhas, guardadoNoMes, saldoCaixinha, isEmergenciaNome } from "@/lib/caixinhas";
import { calcularJornada, semanaDe, FRASES, LancamentoJornada } from "@/lib/jornada";
import { formatCurrency } from "@/lib/format";
import { FrangoData, resultadoPeriodo, limitesDoMes, resumoFechamento, fiadosDoFechamento } from "@/app/(dashboard)/negocio/calc";

export interface LancRetro {
    id: string; tipo: string; valor: number; mes: string; data: string | null; descricao: string | null;
    created_at: string; categorias?: { nome: string; cor: string | null } | null;
}
export interface CategoriaLimite { nome: string; limite_mensal: number }

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export const nomeDoMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1];
export function mesDeslocado(mes: string, delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function mesDeHoje() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const foraDasDespesas = (nome?: string | null) => (nome || "").toLowerCase() === 'fundos' || isEmergenciaNome(nome);
const ehDespesaDoMes = (t: LancRetro) => t.tipo === 'despesa' && !foraDasDespesas(t.categorias?.nome);
const r2 = (n: number) => Math.round(n * 100) / 100;

function totais(lancs: LancRetro[], mes: string, cx: DadosCaixinhas | null) {
    let renda = 0, despesas = 0;
    const porCategoria = new Map<string, { nome: string; cor: string; valor: number }>();
    for (const t of lancs) {
        if (t.mes !== mes) continue;
        if (t.tipo === 'renda') { renda += t.valor; continue; }
        if (!ehDespesaDoMes(t)) continue;
        despesas += t.valor;
        const nome = t.categorias?.nome || "Sem categoria";
        const c = porCategoria.get(nome) || { nome, cor: t.categorias?.cor || '#4d9fff', valor: 0 };
        c.valor += t.valor;
        porCategoria.set(nome, c);
    }
    const guardado = guardadoNoMes(cx?.movimentos || [], mes);
    return { renda: r2(renda), despesas: r2(despesas), guardado: r2(guardado), sobra: r2(renda - guardado - despesas), porCategoria, temDados: renda > 0 || despesas > 0 };
}

const frasesDoMes = (azul: boolean) => (azul ? FRASES.filter(f => !/vermelho/i.test(f)) : FRASES);

function unidas(j: ReturnType<typeof calcularJornada>) {
    return new Set(j.conquistas.filter(c => c.progresso >= 1).map(c => c.id));
}

export function calcularRetrospectiva(p: {
    mes: string;
    lancsMes: LancRetro[];          // lançamentos do mês e dos 2 anteriores
    jornada: LancamentoJornada[];   // todos os lançamentos (campos leves), como na tela Perfil
    categoriasComLimite: CategoriaLimite[];
    cx: DadosCaixinhas | null;
    frango: FrangoData | null;
}) {
    const { mes, lancsMes, cx } = p;
    const anterior = mesDeslocado(mes, -1);
    const [y, m] = mes.split("-").map(Number);
    const inicio = new Date(y, m - 1, 1);
    const fim = new Date(y, m, 1); // primeiro instante do mês seguinte
    const ultimoDia = new Date(y, m, 0).getDate();

    const atual = totais(lancsMes, mes, cx);
    const prev = totais(lancsMes, anterior, cx);
    const despesasDoMes = lancsMes.filter(t => t.mes === mes && ehDespesaDoMes(t));

    // ---- para onde foi ----
    const categorias = Array.from(atual.porCategoria.values()).sort((a, b) => b.valor - a.valor);
    const top = categorias.slice(0, 3).map(c => ({ ...c, valor: r2(c.valor), pct: atual.despesas > 0 ? c.valor / atual.despesas : 0 }));

    // ---- o que subiu e o que caiu (só se o mês anterior tem despesas) ----
    type Variacao = { nome: string; atual: number; anterior: number; diff: number };
    let subiu = null as Variacao | null;
    let caiu = null as Variacao | null;
    if (prev.despesas > 0) {
        const nomes = new Set([...Array.from(atual.porCategoria.keys()), ...Array.from(prev.porCategoria.keys())]);
        for (const nome of Array.from(nomes)) {
            const a = atual.porCategoria.get(nome)?.valor || 0;
            const b = prev.porCategoria.get(nome)?.valor || 0;
            const diff = r2(a - b);
            if (diff >= 20 && (!subiu || diff > subiu.diff)) subiu = { nome, atual: r2(a), anterior: r2(b), diff };
            if (diff <= -20 && (!caiu || diff < caiu.diff)) caiu = { nome, atual: r2(a), anterior: r2(b), diff };
        }
    }

    // ---- limites (uma categoria por nome; contas antigas têm categorias repetidas) ----
    const limitePorNome = new Map<string, number>();
    for (const c of p.categoriasComLimite) if (!limitePorNome.has(c.nome) && c.limite_mensal > 0) limitePorNome.set(c.nome, c.limite_mensal);
    const limites = Array.from(limitePorNome.entries()).map(([nome, limite]) => ({ nome, limite, valor: r2(atual.porCategoria.get(nome)?.valor || 0) }));
    const estouradas = limites.filter(l => l.valor > l.limite).sort((a, b) => (b.valor - b.limite) - (a.valor - a.limite));

    // ---- curiosidades ----
    const maior = despesasDoMes.reduce<LancRetro | null>((a, t) => (!a || t.valor > a.valor ? t : a), null);
    const porDia = new Map<string, number>();
    const porDiaSemana = Array(7).fill(0);
    for (const t of despesasDoMes) {
        if (!t.data) continue;
        porDia.set(t.data, (porDia.get(t.data) || 0) + t.valor);
        const [a, b, c] = t.data.split("-").map(Number);
        porDiaSemana[new Date(a, b - 1, c).getDay()] += t.valor;
    }
    const diaMaisCaro = Array.from(porDia.entries()).sort((a, b) => b[1] - a[1])[0] || null;
    const idxSemana = porDiaSemana.reduce((best, v, i) => (v > porDiaSemana[best] ? i : best), 0);
    const diasSemGasto = ultimoDia - Array.from(porDia.keys()).filter(d => d.startsWith(mes)).length;

    // ---- caixinhas ----
    let caixinhas: null | {
        guardado: number; porCaixinha: { nome: string; valor: number }[];
        reservaSaldo: number | null; reservaCobre: number | null;
    } = null;
    if (cx) {
        const doMes = cx.movimentos.filter(mv => mv.mes === mes && mv.tipo !== 'ajuste');
        const porCaixinha = cx.caixinhas.map(c => ({
            nome: c.nome,
            valor: r2(doMes.filter(mv => mv.caixinha_id === c.id).reduce((s, mv) => s + (mv.tipo === 'guardar' ? mv.valor : -mv.valor), 0)),
        })).filter(c => c.valor !== 0).sort((a, b) => b.valor - a.valor);

        // Mesma conta do Dashboard: saldo de hoje da reserva ÷ média das despesas dos 3 últimos meses.
        // (o saldo trazido dos antigos Fundos entrou como ajuste depois, então o saldo "no fim do mês" sairia errado)
        const emerg = cx.caixinhas.find(c => c.tipo === 'emergencia');
        let reservaSaldo: number | null = null, reservaCobre: number | null = null;
        if (emerg) {
            reservaSaldo = saldoCaixinha(emerg, cx.movimentos, cx.gastos);
            reservaCobre = cx.mediaDespesas > 0 ? Math.max(0, reservaSaldo) / cx.mediaDespesas : null;
        }
        caixinhas = { guardado: atual.guardado, porCaixinha: porCaixinha.slice(0, 4), reservaSaldo, reservaCobre };
    }

    // ---- hábito: semanas lançando e conquistas ganhas no mês ----
    const ate = (d: Date) => p.jornada.filter(l => new Date(l.created_at) < d);
    const cxAte = (d: Date) => cx ? { ...cx, movimentos: cx.movimentos.filter(mv => new Date(mv.created_at) < d) } : null;
    const jFim = calcularJornada(ate(fim), cxAte(fim), fim);
    const jInicio = calcularJornada(ate(inicio), cxAte(inicio), inicio);
    const antes = unidas(jInicio);
    const conquistasNovas = jFim.conquistas.filter(c => c.progresso >= 1 && !antes.has(c.id)).map(c => ({ id: c.id, titulo: c.titulo, icone: c.icone }));

    const semanasDoMes = new Set<string>();
    for (let d = 1; d <= ultimoDia; d++) semanasDoMes.add(semanaDe(new Date(y, m - 1, d)));
    const ativas = new Set(
        [...p.jornada.map(l => l.created_at), ...(cx?.movimentos || []).map(mv => mv.created_at)]
            .filter(Boolean).map(d => semanaDe(new Date(d))),
    );
    const semanasAtivas = Array.from(semanasDoMes).filter(s => ativas.has(s)).length;

    // ---- Hora do Frango (só para quem tem o módulo) ----
    let frango: null | {
        lucro: number; receita: number; vendidos: number; dias: number; meta: number;
        margemPorFrango: number | null; melhorDia: { data: string; vendidos: number } | null;
    } = null;
    if (p.frango) {
        const { de, ate: ateDia } = limitesDoMes(mes);
        const r = resultadoPeriodo(p.frango, de, ateDia);
        if (r.fechamentos > 0) {
            const d = p.frango;
            const melhor = d.fechamentos.filter(f => f.data >= de && f.data <= ateDia)
                .map(f => ({ data: f.data, vendidos: resumoFechamento(f, fiadosDoFechamento(d, f.id)).vendidos }))
                .sort((a, b) => b.vendidos - a.vendidos)[0] || null;
            frango = { lucro: r.lucro, receita: r.receita, vendidos: r.vendidos, dias: r.fechamentos, meta: d.config.meta_mensal, margemPorFrango: r.margemPorFrango, melhorDia: melhor };
        }
    }

    // ---- uma sugestão para o próximo mês ----
    const proximo = nomeDoMes(mesDeslocado(mes, 1));
    let sugestao: string | null = null;
    if (atual.sobra < 0 && top[0]) {
        const pct = Math.min(100, Math.ceil(Math.abs(atual.sobra) / top[0].valor * 100));
        sugestao = `Faltaram ${formatCurrency(Math.abs(atual.sobra))} para fechar no azul. ${top[0].nome} foi o maior gasto: cortar ${pct}% dele em ${proximo} já resolve.`;
    } else if (subiu) {
        sugestao = `${subiu.nome} subiu ${formatCurrency(subiu.diff)} em relação a ${nomeDoMes(anterior)}. Se voltar ao nível de antes, sobram mais ${formatCurrency(subiu.diff)} em ${proximo}.`;
    } else if (top[0]) {
        sugestao = `Se gastar 20% menos em ${top[0].nome}, sobram mais ${formatCurrency(top[0].valor * 0.2)} em ${proximo}.`;
    }

    return {
        mes, anterior,
        temDados: atual.temDados,
        renda: atual.renda, guardado: atual.guardado, despesas: atual.despesas, sobra: atual.sobra,
        sobraAnterior: prev.temDados ? prev.sobra : null,
        azulSeguidos: atual.sobra >= 0 ? jFim.azulSeguidos : 0,
        top, totalCategorias: categorias.length,
        subiu, caiu,
        limites: { total: limites.length, dentro: limites.length - estouradas.length, estouradas: estouradas.slice(0, 3) },
        maiorGasto: maior ? { descricao: maior.descricao || maior.categorias?.nome || "Gasto", valor: maior.valor, data: maior.data, categoria: maior.categorias?.nome || null } : null,
        diaMaisCaro: diaMaisCaro ? { data: diaMaisCaro[0], valor: r2(diaMaisCaro[1]) } : null,
        diaDaSemana: despesasDoMes.length ? { nome: DIAS_SEMANA[idxSemana], valor: r2(porDiaSemana[idxSemana]) } : null,
        diasSemGasto, ultimoDia,
        caixinhas,
        lancamentos: lancsMes.filter(t => t.mes === mes).length,
        semanasAtivas, semanasDoMes: semanasDoMes.size, sequencia: jFim.sequencia,
        conquistasNovas,
        frango,
        sugestao,
        frase: frasesDoMes(atual.sobra >= 0)[(y * 12 + m) % frasesDoMes(atual.sobra >= 0).length],
    };
}

export type Retrospectiva = ReturnType<typeof calcularRetrospectiva>;
