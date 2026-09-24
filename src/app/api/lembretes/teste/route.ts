// "Enviar teste agora" do Perfil: manda o lembrete para os aparelhos do próprio usuário logado.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enviarPush, montarLembrete } from "@/lib/push-servidor";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ erro: "faça login" }, { status: 401 });

    // Cliente com o login do próprio usuário: o RLS só deixa ver as inscrições dele.
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });

    const { data: inscricoes } = await sb.from("lembrete_inscricoes").select("id, endpoint, p256dh, auth").eq("user_id", user.id);
    if (!inscricoes?.length) return NextResponse.json({ erro: "nenhum aparelho com lembrete ativado" }, { status: 404 });

    const semana = new Date();
    semana.setDate(semana.getDate() - ((semana.getDay() + 6) % 7));
    semana.setHours(0, 0, 0, 0);
    const { count } = await sb.from("lancamentos").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).gte("created_at", semana.toISOString());

    const conteudo = montarLembrete({ nome: user.user_metadata?.display_name, porque: user.user_metadata?.porque, lancamentos_semana: count ?? 0 });
    let enviados = 0;
    for (const i of inscricoes) {
        const status = await enviarPush(i, { ...conteudo, title: `[Teste] ${conteudo.title}` });
        if (status === "ok") enviados++;
        if (status === "expirada") await sb.from("lembrete_inscricoes").delete().eq("id", i.id);
    }
    return NextResponse.json({ enviados, aparelhos: inscricoes.length });
}
