import { NextResponse } from 'next/server';

export async function POST() {
    // Mock: simula uma sincronização Pluggy
    await new Promise(resolve => setTimeout(resolve, 1500));

    return NextResponse.json({
        status: 'ok',
        message: 'Sincronização concluída (mock)',
        transactions_imported: 8,
        last_sync: new Date().toISOString(),
        mock: true,
    });
}
