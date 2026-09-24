// Jornada do usuário no FinFamily (tela Perfil): sequência de semanas lançando, meses no azul,
// números desde o começo e conquistas. Tudo calculado a partir dos dados que já existem.
import { DadosCaixinhas, guardadoNoMes, saldoCaixinha, isEmergenciaNome } from "@/lib/caixinhas";

export interface LancamentoJornada { tipo: string; valor: number; mes: string; created_at: string; categorias?: { nome: string } | null }

const foraDasDespesas = (nome?: string | null) => (nome || "").toLowerCase() === 'fundos' || isEmergenciaNome(nome);

function dataLocal(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Segunda-feira da semana (data local). */
export function semanaDe(d: Date) {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return dataLocal(s);
}
function semanaAnterior(semana: string) {
    const [y, m, d] = semana.split("-").map(Number);
    return dataLocal(new Date(y, m - 1, d - 7));
}
function proximoMes(mes: string) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function calcularJornada(lancs: LancamentoJornada[], cx: DadosCaixinhas | null, hoje = new Date()) {
    // ---- semanas com atividade (lançamento ou movimento de caixinha) ----
    const datas = [...lancs.map(l => l.created_at), ...(cx?.movimentos || []).map(m => m.created_at)].filter(Boolean);
    const semanas = new Set(datas.map(d => semanaDe(new Date(d))));
    const estaSemana = semanaDe(hoje);

    // a semana atual ainda não acabou: se não teve lançamento, a sequência conta até a semana passada
    let cursor = semanas.has(estaSemana) ? estaSemana : semanaAnterior(estaSemana);
    let sequencia = 0;
    while (semanas.has(cursor)) { sequencia++; cursor = semanaAnterior(cursor); }

    const ordenadas = Array.from(semanas).sort();
    let recorde = 0, atual = 0, anterior = "";
    for (const s of ordenadas) {
        atual = anterior && semanaAnterior(s) === anterior ? atual + 1 : 1;
        recorde = Math.max(recorde, atual);
        anterior = s;
    }

    const ultimas8: { semana: string; ativa: boolean }[] = [];
    let s = estaSemana;
    for (let i = 0; i < 8; i++) { ultimas8.unshift({ semana: s, ativa: semanas.has(s) }); s = semanaAnterior(s); }

    // ---- meses no azul (só meses já fechados) ----
    const mesAtual = dataLocal(hoje).slice(0, 7);
    const porMes = new Map<string, { renda: number; despesas: number }>();
    for (const l of lancs) {
        const p = porMes.get(l.mes) || { renda: 0, despesas: 0 };
        if (l.tipo === 'renda') p.renda += l.valor;
        else if (!foraDasDespesas(l.categorias?.nome)) p.despesas += l.valor;
        porMes.set(l.mes, p);
    }
    const mesesComDados = Array.from(porMes.keys()).filter(m => m < mesAtual).sort();
    const movimentos = cx?.movimentos || [];
    let azulSeguidos = 0, azulRecorde = 0, run = 0, mesesNoAzul = 0;
    if (mesesComDados.length) {
        for (let m = mesesComDados[0]; m < mesAtual; m = proximoMes(m)) {
            const p = porMes.get(m);
            const azul = !!p && (p.renda > 0 || p.despesas > 0) && p.renda - guardadoNoMes(movimentos, m) - p.despesas >= 0;
            run = azul ? run + 1 : 0;
            if (azul) mesesNoAzul++;
            azulRecorde = Math.max(azulRecorde, run);
        }
        azulSeguidos = run;
    }

    // ---- caixinhas ----
    const caixinhas = cx?.caixinhas || [];
    const saldo = (c: any) => cx ? saldoCaixinha(c, cx.movimentos, cx.gastos) : 0;
    const totalGuardado = caixinhas.reduce((t, c) => t + saldo(c), 0);
    const emerg = caixinhas.find(c => c.tipo === 'emergencia');
    const cobre = emerg && cx && cx.mediaDespesas > 0 ? saldo(emerg) / cx.mediaDespesas : 0;
    const guardouAlgumaVez = movimentos.some(m => m.tipo === 'guardar');
    const metaBatida = caixinhas.some(c => c.meta && saldo(c) >= c.meta);

    // ---- desde quando ----
    const primeira = datas.length ? datas.reduce((a, b) => (a < b ? a : b)) : null;
    const desde = primeira ? new Date(primeira) : null;
    const mesesUsando = desde ? (hoje.getFullYear() - desde.getFullYear()) * 12 + hoje.getMonth() - desde.getMonth() + 1 : 0;

    const total = lancs.length;
    const conquistas = [
        { id: 'primeiro', icone: 'pencil', titulo: 'Primeiro lançamento', progresso: Math.min(1, total), dica: 'Lance seu primeiro gasto ou receita.' },
        { id: 'cem', icone: 'list', titulo: '100 lançamentos', progresso: Math.min(1, total / 100), dica: `${total} de 100 lançamentos.` },
        { id: 'quinhentos', icone: 'list', titulo: '500 lançamentos', progresso: Math.min(1, total / 500), dica: `${total} de 500 lançamentos.` },
        { id: 'azul1', icone: 'sun', titulo: 'Mês no azul', progresso: Math.min(1, azulRecorde), dica: 'Feche um mês gastando menos que o líquido.' },
        { id: 'azul3', icone: 'trophy', titulo: '3 meses no azul', progresso: Math.min(1, azulRecorde / 3), dica: `Seu recorde: ${azulRecorde} ${azulRecorde === 1 ? "mês" : "meses"} seguidos no azul.` },
        { id: 'azul6', icone: 'crown', titulo: '6 meses no azul', progresso: Math.min(1, azulRecorde / 6), dica: `Seu recorde: ${azulRecorde} ${azulRecorde === 1 ? "mês" : "meses"} seguidos no azul.` },
        { id: 'sem4', icone: 'flame', titulo: '4 semanas seguidas', progresso: Math.min(1, recorde / 4), dica: `Seu recorde: ${recorde} ${recorde === 1 ? "semana" : "semanas"} seguidas lançando.` },
        { id: 'sem12', icone: 'flame', titulo: '12 semanas seguidas', progresso: Math.min(1, recorde / 12), dica: `Seu recorde: ${recorde} ${recorde === 1 ? "semana" : "semanas"} seguidas lançando.` },
        { id: 'caixinha', icone: 'piggy', titulo: 'Começou a guardar', progresso: guardouAlgumaVez ? 1 : 0, dica: 'Guarde dinheiro numa caixinha.' },
        { id: 'meta', icone: 'target', titulo: 'Meta alcançada', progresso: metaBatida ? 1 : 0, dica: 'Alcance a meta de uma caixinha.' },
        { id: 'reserva1', icone: 'shield', titulo: 'Reserva de 1 mês', progresso: Math.min(1, cobre), dica: `Sua reserva cobre ${cobre.toFixed(1).replace('.', ',')} mês das despesas.` },
        { id: 'reserva3', icone: 'shield', titulo: 'Reserva de 3 meses', progresso: Math.min(1, cobre / 3), dica: `Sua reserva cobre ${cobre.toFixed(1).replace('.', ',')} meses das despesas.` },
        { id: 'reserva6', icone: 'award', titulo: 'Reserva de 6 meses', progresso: Math.min(1, cobre / 6), dica: 'A meta de ouro da reserva de emergência.' },
    ];

    return {
        sequencia, recorde, ultimas8, estaSemanaAtiva: semanas.has(estaSemana),
        azulSeguidos, azulRecorde, mesesNoAzul,
        total, desde, mesesUsando, totalGuardado, cobre,
        conquistas,
    };
}

// Frases próprias do FinFamily, uma por dia.
export const FRASES = [
    "Cada real anotado é um real que obedece você.",
    "O mês perfeito não existe. O mês anotado, sim.",
    "Quem acompanha o dinheiro toda semana não leva susto no fim do mês.",
    "Pequenos valores guardados com constância viram a reserva que te dá paz.",
    "Organizar hoje é o presente que a sua família recebe amanhã.",
    "Você não precisa ganhar mais para começar. Precisa saber para onde vai.",
    "Gastar não é o problema. Gastar sem ver é.",
    "Cinco minutos por semana com as suas contas valem mais que um mês de preocupação.",
    "A reserva de emergência é o que transforma um imprevisto em só mais um dia.",
    "Todo grande objetivo começa como uma caixinha com pouco dinheiro.",
    "Mês no vermelho não é fracasso. É informação para o próximo.",
    "Quem sabe quanto sobra consegue decidir o que fazer com a sobra.",
    "Constância vence intensidade. Anote hoje, e amanhã de novo.",
    "O dinheiro que você não acompanha escolhe o caminho sozinho.",
    "Guardar primeiro e gastar depois muda o fim do mês.",
    "Cada lançamento é uma pergunta respondida sobre a sua vida.",
    "Não compare o seu começo com o meio de ninguém. Compare com o seu mês passado.",
    "Controle não é aperto. É liberdade de gastar sem culpa no que importa.",
    "A família que conversa sobre dinheiro briga menos por dinheiro.",
    "Seu eu do futuro está contando com o que você anota agora.",
    "Um mês no azul é sorte. Três seguidos é método.",
    "Você já começou. Isso é o mais difícil.",
];

export function fraseDoDia(hoje = new Date()) {
    const inicioAno = new Date(hoje.getFullYear(), 0, 0);
    const dia = Math.floor((hoje.getTime() - inicioAno.getTime()) / 86400000);
    return FRASES[dia % FRASES.length];
}
