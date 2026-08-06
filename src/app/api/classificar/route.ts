import { NextResponse } from 'next/server';

interface RegraClassificacao {
    padrao: string;
    tipo_transacao: string;
    categoria_nome?: string;
    subcategoria_nome?: string;
}

const MOCK_REGRAS: RegraClassificacao[] = [
    { padrao: "netflix|spotify|disney|hbo|prime video", tipo_transacao: "despesa", categoria_nome: "Assinaturas", subcategoria_nome: "Streaming" },
    { padrao: "uber|99|cabify", tipo_transacao: "despesa", categoria_nome: "Transporte", subcategoria_nome: "App de Corrida" },
    { padrao: "supermercado|mercado|atacadao|assai", tipo_transacao: "despesa", categoria_nome: "Alimentação", subcategoria_nome: "Supermercado" },
    { padrao: "farmacia|drogaria|drogasil", tipo_transacao: "despesa", categoria_nome: "Saúde", subcategoria_nome: "Farmácia" },
    { padrao: "salario|empresa|ltda|pagamento", tipo_transacao: "renda", categoria_nome: "Salário" },
    { padrao: "devolu[cç][aã]o|emprestimo", tipo_transacao: "devolucao" },
];

function classificar(descricao: string, regras: RegraClassificacao[]) {
    const desc = descricao.toLowerCase();
    for (const regra of regras) {
        const regex = new RegExp(regra.padrao, 'i');
        if (regex.test(desc)) {
            return {
                classificado: true,
                tipo_transacao: regra.tipo_transacao,
                categoria_nome: regra.categoria_nome || null,
                subcategoria_nome: regra.subcategoria_nome || null,
                regra_usada: regra.padrao,
            };
        }
    }
    return { classificado: false, tipo_transacao: null, categoria_nome: null, subcategoria_nome: null, regra_usada: null };
}

export async function POST(req: Request) {
    const { descricao, regras_usuario } = await req.json();

    if (!descricao) {
        return NextResponse.json({ error: 'descricao é obrigatório' }, { status: 400 });
    }

    const todasRegras = [...(regras_usuario || []), ...MOCK_REGRAS];
    const resultado = classificar(descricao, todasRegras);

    return NextResponse.json({
        ...resultado,
        mock: true,
    });
}
