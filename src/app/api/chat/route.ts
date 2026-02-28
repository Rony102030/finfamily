import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { messages, apiKey } = await req.json();

        if (!apiKey) {
            return NextResponse.json({ error: 'Chave da API da Anthropic não configurada nas Configurações.' }, { status: 400 });
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307', // fast model
                max_tokens: 1024,
                messages: messages,
                system: "Você é o AntiGravity IA, um consultor financeiro especialista. O usuário está usando o app FinFamily. Responda de forma curta, direta e amigável em Português do Brasil. Formate em Markdown simplificado."
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Erro na API da Anthropic');
        }

        const data = await response.json();
        return NextResponse.json({ content: data.content[0].text });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
