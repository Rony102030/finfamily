import { NextResponse } from 'next/server';

const MOCK_TRANSACTIONS = [
    {
        id: "pluggy-tx-001",
        tipo: "DEBIT",
        descricao: "PIX Enviado - MARIA SILVA",
        valor: 150.00,
        data: "2026-08-03",
        status_pluggy: "POSTED",
        metodo_pagamento: "PIX",
        recebedor_nome: "MARIA SILVA",
    },
    {
        id: "pluggy-tx-002",
        tipo: "CREDIT",
        descricao: "PIX Recebido - JOAO SANTOS",
        valor: 500.00,
        data: "2026-08-02",
        status_pluggy: "POSTED",
        metodo_pagamento: "PIX",
        pagador_nome: "JOAO SANTOS",
    },
    {
        id: "pluggy-tx-003",
        tipo: "DEBIT",
        descricao: "Pagamento - NETFLIX.COM",
        valor: 55.90,
        data: "2026-08-01",
        status_pluggy: "POSTED",
        metodo_pagamento: "DEBITO",
        recebedor_nome: "NETFLIX",
    },
    {
        id: "pluggy-tx-004",
        tipo: "DEBIT",
        descricao: "Pagamento - UBER *TRIP",
        valor: 23.50,
        data: "2026-08-01",
        status_pluggy: "POSTED",
        metodo_pagamento: "DEBITO",
        recebedor_nome: "UBER",
    },
    {
        id: "pluggy-tx-005",
        tipo: "CREDIT",
        descricao: "Transferência Recebida - EMPRESA ABC LTDA",
        valor: 3200.00,
        data: "2026-07-30",
        status_pluggy: "POSTED",
        metodo_pagamento: "TED",
        pagador_nome: "EMPRESA ABC LTDA",
    },
    {
        id: "pluggy-tx-006",
        tipo: "DEBIT",
        descricao: "Compra no débito - SUPERMERCADO BOM PRECO",
        valor: 287.45,
        data: "2026-07-29",
        status_pluggy: "POSTED",
        metodo_pagamento: "DEBITO",
        recebedor_nome: "SUPERMERCADO BOM PRECO",
    },
    {
        id: "pluggy-tx-007",
        tipo: "DEBIT",
        descricao: "PIX Enviado - FARMACIA POPULAR",
        valor: 45.90,
        data: "2026-07-28",
        status_pluggy: "POSTED",
        metodo_pagamento: "PIX",
        recebedor_nome: "FARMACIA POPULAR",
    },
    {
        id: "pluggy-tx-008",
        tipo: "CREDIT",
        descricao: "PIX Recebido - DEVOLUÇAO EMPRESTIMO",
        valor: 200.00,
        data: "2026-07-27",
        status_pluggy: "POSTED",
        metodo_pagamento: "PIX",
        pagador_nome: "CARLOS OLIVEIRA",
    },
];

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const mes = searchParams.get('mes');

    let filtered = MOCK_TRANSACTIONS;
    if (mes) {
        filtered = MOCK_TRANSACTIONS.filter(t => t.data.startsWith(mes));
    }

    return NextResponse.json({
        data: filtered,
        total: filtered.length,
        mock: true,
    });
}
