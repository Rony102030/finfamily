// Só no servidor (rotas /api/lembretes): assina e envia as notificações do lembrete semanal.
import webpush from "web-push";

export interface Inscricao { endpoint: string; p256dh: string; auth: string }
export interface DadosLembrete { nome?: string; porque?: string | null; lancamentos_semana?: number }

let configurado = false;
function configurar() {
    if (configurado) return;
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) throw new Error("Chaves VAPID não configuradas no servidor.");
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://finfamily-ruby.vercel.app", pub, priv);
    configurado = true;
}

/** Texto do lembrete: muda se a pessoa ainda não lançou nada na semana. */
export function montarLembrete(d: DadosLembrete) {
    const nome = (d.nome || "").trim().split(" ")[0];
    const oi = nome ? `${nome}, ` : "";
    const n = d.lancamentos_semana ?? 0;
    const porque = d.porque ? ` Lembre do seu porquê: ${d.porque}.` : "";
    if (n === 0) {
        return {
            title: "Sua semana ainda está sem lançamentos",
            body: `${oi}tire 5 minutos para lançar os gastos da semana e manter sua sequência.${porque}`,
            url: "/dashboard",
        };
    }
    return {
        title: "Hora da revisão da semana",
        body: `${oi}você fez ${n} ${n === 1 ? "lançamento" : "lançamentos"} esta semana. Confira se faltou algo e veja quanto ainda dá pra gastar.${porque}`,
        url: "/dashboard",
    };
}

/** Envia uma notificação. Retorna "ok", "expirada" (apagar a inscrição) ou "erro". */
export async function enviarPush(i: Inscricao, conteudo: { title: string; body: string; url?: string }) {
    configurar();
    try {
        await webpush.sendNotification(
            { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
            JSON.stringify(conteudo),
            { TTL: 60 * 60 * 12, urgency: "normal" },
        );
        return "ok" as const;
    } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) return "expirada" as const;
        console.error("[push]", e?.statusCode, e?.body || e?.message);
        return "erro" as const;
    }
}
