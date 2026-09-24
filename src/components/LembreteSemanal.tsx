"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Bell, BellOff, Send, Loader2 } from "lucide-react";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const HORAS = Array.from({ length: 18 }, (_, i) => i + 6); // 6h às 23h

function chaveParaBytes(base64: string) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function nomeDoAparelho() {
    const ua = navigator.userAgent;
    if (/iphone|ipad/i.test(ua)) return "iPhone";
    if (/android/i.test(ua)) return "Android";
    if (/windows/i.test(ua)) return "Windows";
    if (/mac/i.test(ua)) return "Mac";
    return "Navegador";
}

type Estado = 'carregando' | 'sem-suporte' | 'iphone-instalar' | 'bloqueado' | 'desativado' | 'ativado' | 'sem-sw';

export function LembreteSemanal({ userId }: { userId: string }) {
    const [estado, setEstado] = useState<Estado>('carregando');
    const [dia, setDia] = useState(0);
    const [hora, setHora] = useState(20);
    const [outros, setOutros] = useState(0);
    const [ocupado, setOcupado] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);

    const avisar = (t: string) => { setAviso(t); setTimeout(() => setAviso(null), 4000); };

    const carregar = async () => {
        const suporte = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
        const ios = /iphone|ipad/i.test(navigator.userAgent);
        const instalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
        if (!suporte) return setEstado(ios && !instalado ? 'iphone-instalar' : 'sem-suporte');
        if (Notification.permission === "denied") return setEstado('bloqueado');

        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return setEstado('sem-sw');
        const sub = await reg.pushManager.getSubscription();
        const { data: linhas } = await supabase.from('lembrete_inscricoes').select('endpoint, dia_semana, hora').eq('user_id', userId);
        const minha = sub ? linhas?.find(l => l.endpoint === sub.endpoint) : null;
        const referencia = minha || linhas?.[0];
        if (referencia) { setDia(referencia.dia_semana); setHora(referencia.hora); }
        setOutros((linhas || []).filter(l => l.endpoint !== sub?.endpoint).length);
        setEstado(minha ? 'ativado' : 'desativado');
    };

    useEffect(() => { carregar().catch(() => setEstado('sem-suporte')); }, [userId]);

    const ativar = async () => {
        setOcupado(true);
        try {
            const permissao = await Notification.requestPermission();
            if (permissao !== "granted") { setEstado(permissao === "denied" ? 'bloqueado' : 'desativado'); return; }
            const reg = await navigator.serviceWorker.ready;
            const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!chave) throw new Error("Lembrete ainda não configurado no servidor.");
            const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) });
            const j = sub.toJSON() as any;
            const { error } = await supabase.rpc('lembrete_inscrever', {
                p_endpoint: sub.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth,
                p_dia: dia, p_hora: hora, p_fuso: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
                p_aparelho: nomeDoAparelho(),
            });
            if (error) throw error;
            setEstado('ativado');
            avisar("Lembrete ativado neste aparelho.");
        } catch (e: any) {
            alert("Não consegui ativar: " + (e?.message || e));
        } finally {
            setOcupado(false);
        }
    };

    const desativar = async () => {
        setOcupado(true);
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
            await supabase.from('lembrete_inscricoes').delete().eq('endpoint', sub.endpoint);
            await sub.unsubscribe();
        }
        setOcupado(false);
        setEstado('desativado');
        avisar("Lembrete desativado neste aparelho.");
    };

    const mudarHorario = async (novoDia: number, novaHora: number) => {
        setDia(novoDia); setHora(novaHora);
        // o mesmo dia e hora valem para todos os aparelhos da pessoa
        const { error } = await supabase.from('lembrete_inscricoes').update({ dia_semana: novoDia, hora: novaHora }).eq('user_id', userId);
        if (!error && (estado === 'ativado' || outros > 0)) avisar(`Lembrete: ${DIAS[novoDia].toLowerCase()} às ${novaHora}h.`);
    };

    const testar = async () => {
        setOcupado(true);
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch('/api/lembretes/teste', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` } });
        const j = await r.json().catch(() => ({}));
        setOcupado(false);
        avisar(r.ok ? `Teste enviado para ${j.enviados} de ${j.aparelhos} aparelho(s).` : `Não enviou: ${j.erro || r.status}`);
    };

    const podeEscolher = estado === 'ativado' || estado === 'desativado';

    return (
        <section className="bg-cards border border-borders rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase font-bold tracking-wider text-foreground/60">Lembrete semanal</p>
                {estado === 'ativado' && <span className="text-xs font-bold text-brand-green flex items-center gap-1"><Bell className="w-3.5 h-3.5" />Ativado neste aparelho</span>}
            </div>
            <p className="text-sm text-foreground/80 mt-2">
                Uma notificação por semana para você revisar os lançamentos em 5 minutos. Se a semana estiver sem lançamentos, ela avisa para não perder a sequência.
            </p>

            {podeEscolher && (
                <div className="flex flex-wrap items-center gap-2 mt-4 text-sm">
                    <span className="text-foreground/70">Toda</span>
                    <select value={dia} onChange={e => mudarHorario(Number(e.target.value), hora)} className="bg-surface border border-borders rounded-lg px-2 py-1.5 text-white">
                        {DIAS.map((d, i) => <option key={d} value={i}>{d.toLowerCase()}</option>)}
                    </select>
                    <span className="text-foreground/70">às</span>
                    <select value={hora} onChange={e => mudarHorario(dia, Number(e.target.value))} className="bg-surface border border-borders rounded-lg px-2 py-1.5 text-white">
                        {HORAS.map(h => <option key={h} value={h}>{h}h</option>)}
                    </select>
                </div>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
                {estado === 'carregando' && <Loader2 className="w-5 h-5 animate-spin text-foreground/40" />}
                {estado === 'desativado' && (
                    <button onClick={ativar} disabled={ocupado} className="font-bold py-2.5 px-4 rounded-xl bg-brand-green text-background flex items-center gap-2 disabled:opacity-50">
                        <Bell className="w-4 h-4" /> Ativar neste aparelho
                    </button>
                )}
                {estado === 'ativado' && (
                    <>
                        <button onClick={testar} disabled={ocupado} className="font-bold py-2.5 px-4 rounded-xl border border-brand-green text-brand-green flex items-center gap-2 disabled:opacity-50">
                            <Send className="w-4 h-4" /> Enviar teste agora
                        </button>
                        <button onClick={desativar} disabled={ocupado} className="text-sm py-2.5 px-3 rounded-xl border border-borders text-foreground/70 hover:text-white flex items-center gap-2">
                            <BellOff className="w-4 h-4" /> Desativar
                        </button>
                    </>
                )}
            </div>

            {estado === 'iphone-instalar' && <p className="text-sm text-brand-yellow mt-3">No iPhone, primeiro instale o app: no Safari, toque em Compartilhar → "Adicionar à Tela de Início". Depois abra o FinFamily pelo ícone e ative aqui.</p>}
            {estado === 'sem-suporte' && <p className="text-sm text-foreground/60 mt-3">Este navegador não aceita notificações. Use o Chrome no Android ou no computador, ou o app instalado no iPhone.</p>}
            {estado === 'bloqueado' && <p className="text-sm text-brand-yellow mt-3">As notificações do FinFamily estão bloqueadas neste navegador. Libere nas configurações do site (cadeado ao lado do endereço) e volte aqui.</p>}
            {estado === 'sem-sw' && <p className="text-sm text-foreground/60 mt-3">O lembrete funciona no app publicado (finfamily-ruby.vercel.app) ou no app instalado.</p>}
            {outros > 0 && <p className="text-xs text-foreground/50 mt-3">Também ativado em {outros} outro(s) aparelho(s).</p>}
            {aviso && <p className="text-sm text-brand-green font-bold mt-3">{aviso}</p>}
        </section>
    );
}
