// Chamado de hora em hora pelo Supabase (pg_cron + pg_net) com a lista de quem deve receber o lembrete agora.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { enviarPush, montarLembrete } from "@/lib/push-servidor";

export const runtime = "nodejs";

function segredoConfere(recebido: string | null) {
    const esperado = process.env.LEMBRETE_SEGREDO || "";
    if (!recebido || !esperado || recebido.length !== esperado.length) return false;
    return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

export async function POST(req: Request) {
    const segredo = req.headers.get("x-segredo");
    if (!segredoConfere(segredo)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

    const { itens = [] } = await req.json().catch(() => ({ itens: [] }));
    const resultados = await Promise.all((itens as any[]).map(async (i) => ({
        endpoint: i.endpoint as string,
        status: await enviarPush(i, montarLembrete(i)),
    })));

    const expiradas = resultados.filter(r => r.status === "expirada").map(r => r.endpoint);
    if (expiradas.length) {
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        await sb.rpc("lembrete_desativar", { p_segredo: segredo, p_endpoints: expiradas });
    }

    return NextResponse.json({
        enviados: resultados.filter(r => r.status === "ok").length,
        expirados: expiradas.length,
        erros: resultados.filter(r => r.status === "erro").length,
    });
}
