"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { formatCurrency } from "@/lib/format";
import { carregarCaixinhas, DadosCaixinhas } from "@/lib/caixinhas";
import { calcularJornada, fraseDoDia, LancamentoJornada } from "@/lib/jornada";
import { LembreteSemanal } from "@/components/LembreteSemanal";
import Link from "next/link";
import { mesDeslocado, mesDeHoje } from "@/lib/retrospectiva";
import {
    Camera, Check, Flame, Sparkles, Pencil, List, Sun, Trophy, Crown, PiggyBank, Target, ShieldCheck, Award, Quote, Trash2, Loader2,
} from "lucide-react";

const ICONES: Record<string, any> = { pencil: Pencil, list: List, sun: Sun, trophy: Trophy, crown: Crown, flame: Flame, piggy: PiggyBank, target: Target, shield: ShieldCheck, award: Award };
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Recorta a imagem no centro em quadrado e reduz para 320px (JPEG), para a foto ficar leve. */
async function prepararFoto(arquivo: File): Promise<Blob> {
    const url = URL.createObjectURL(arquivo);
    try {
        const img = await new Promise<HTMLImageElement>((ok, erro) => {
            const i = new Image();
            i.onload = () => ok(i);
            i.onerror = () => erro(new Error("Não consegui abrir essa imagem."));
            i.src = url;
        });
        const lado = Math.min(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 320;
        canvas.getContext("2d")!.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 320, 320);
        return await new Promise<Blob>((ok, erro) => canvas.toBlob(b => (b ? ok(b) : erro(new Error("Falha ao preparar a foto."))), "image/jpeg", 0.85));
    } finally {
        URL.revokeObjectURL(url);
    }
}

export default function PerfilPage() {
    const { user } = useAuth();
    const { activeMonth } = useAppStore();
    const meta = user?.user_metadata || {};

    const [lancs, setLancs] = useState<LancamentoJornada[]>([]);
    const [caixinhas, setCaixinhas] = useState<DadosCaixinhas | null>(null);
    const [carregando, setCarregando] = useState(true);

    const [nome, setNome] = useState("");
    const [porque, setPorque] = useState("");
    const [salvo, setSalvo] = useState<string | null>(null);
    const [enviandoFoto, setEnviandoFoto] = useState(false);
    const [conquistaAberta, setConquistaAberta] = useState<string | null>(null);
    const inputFoto = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setNome(meta.display_name || "");
        setPorque(meta.porque || "");
    }, [user?.id]);

    useEffect(() => {
        if (!user) return;
        (async () => {
            const [l, cx] = await Promise.all([
                supabase.from('lancamentos').select('tipo, valor, mes, created_at, categorias(nome)').eq('user_id', user.id).limit(20000),
                carregarCaixinhas(user.id, activeMonth).catch(() => null),
            ]);
            setLancs((l.data || []).map((x: any) => ({ ...x, valor: Number(x.valor) })));
            setCaixinhas(cx);
            setCarregando(false);
        })();
    }, [user?.id]);

    const j = useMemo(() => calcularJornada(lancs, caixinhas), [lancs, caixinhas]);

    const salvar = async (campos: Record<string, any>, aviso: string) => {
        const { error } = await supabase.auth.updateUser({ data: campos });
        if (error) return alert("Erro ao salvar: " + error.message);
        setSalvo(aviso);
        setTimeout(() => setSalvo(null), 2500);
    };

    const trocarFoto = async (arquivo?: File) => {
        if (!arquivo || !user) return;
        if (!arquivo.type.startsWith("image/")) return alert("Escolha uma imagem.");
        setEnviandoFoto(true);
        try {
            const foto = await prepararFoto(arquivo);
            const caminho = `${user.id}/${Date.now()}.jpg`;
            const { error } = await supabase.storage.from('avatars').upload(caminho, foto, { contentType: 'image/jpeg', upsert: false });
            if (error) throw error;
            const { data } = supabase.storage.from('avatars').getPublicUrl(caminho);
            const antiga = meta.avatar_path as string | undefined;
            await salvar({ avatar_url: data.publicUrl, avatar_path: caminho }, "Foto atualizada");
            if (antiga) await supabase.storage.from('avatars').remove([antiga]);
        } catch (e: any) {
            const semBucket = /bucket not found/i.test(e?.message || "");
            alert(semBucket ? "Falta rodar o migration_perfil.sql no Supabase para ativar as fotos." : "Erro ao enviar a foto: " + (e?.message || e));
        } finally {
            setEnviandoFoto(false);
            if (inputFoto.current) inputFoto.current.value = "";
        }
    };

    const removerFoto = async () => {
        if (!confirm("Remover a foto de perfil?")) return;
        const antiga = meta.avatar_path as string | undefined;
        await salvar({ avatar_url: null, avatar_path: null }, "Foto removida");
        if (antiga) await supabase.storage.from('avatars').remove([antiga]);
    };

    const inicial = (meta.display_name || user?.email || "U").charAt(0).toUpperCase();
    const desbloqueadas = j.conquistas.filter(c => c.progresso >= 1).length;
    const card = "bg-cards border border-borders rounded-2xl p-4 sm:p-5";

    return (
        <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in duration-500">
            {/* Foto e nome */}
            <section className={`${card} flex flex-col sm:flex-row sm:items-center gap-5`}>
                <div className="relative w-24 h-24 flex-shrink-0 mx-auto sm:mx-0">
                    {meta.avatar_url
                        ? <img src={meta.avatar_url} alt="Foto de perfil" className="w-24 h-24 rounded-full object-cover border-2 border-brand-green" />
                        : <div className="w-24 h-24 rounded-full border-2 border-brand-green flex items-center justify-center text-4xl font-bold text-brand-green" style={{ background: 'rgba(0,229,160,0.12)' }}>{inicial}</div>}
                    <button onClick={() => inputFoto.current?.click()} disabled={enviandoFoto} title="Trocar foto"
                        className="absolute -right-1 -bottom-1 w-9 h-9 rounded-full bg-brand-green text-background flex items-center justify-center shadow-lg hover:scale-105 transition-transform disabled:opacity-60">
                        {enviandoFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    </button>
                    <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={e => trocarFoto(e.target.files?.[0])} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex gap-2">
                        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Como você quer ser chamado?"
                            className="flex-1 min-w-0 bg-surface border border-borders rounded-xl px-3 py-2 text-lg font-bold text-white outline-none focus:border-brand-green" />
                        {nome !== (meta.display_name || "") && (
                            <button onClick={() => salvar({ display_name: nome.trim() }, "Nome salvo")} className="px-3 rounded-xl bg-brand-green text-background font-bold"><Check className="w-5 h-5" /></button>
                        )}
                    </div>
                    <p className="text-sm text-foreground/60 truncate">{user?.email}</p>
                    {j.desde && <p className="text-xs text-foreground/50">Organizando as finanças desde {MESES[j.desde.getMonth()]} de {j.desde.getFullYear()}</p>}
                    <div className="flex items-center gap-3 text-xs">
                        {salvo && <span className="text-brand-green font-bold">{salvo}</span>}
                        {meta.avatar_url && <button onClick={removerFoto} className="text-foreground/50 hover:text-brand-red flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Remover foto</button>}
                    </div>
                </div>
            </section>

            {/* Frase do dia */}
            <section className="rounded-2xl p-4 sm:p-5 border flex gap-3" style={{ background: 'rgba(255,201,77,0.06)', borderColor: 'rgba(255,201,77,0.3)' }}>
                <Quote className="w-6 h-6 text-brand-yellow flex-shrink-0" />
                <div>
                    <p className="text-xs uppercase font-bold tracking-wider text-brand-yellow mb-1">Frase do dia</p>
                    <p className="text-white text-lg leading-snug">{fraseDoDia()}</p>
                </div>
            </section>

            {/* Meu porquê */}
            <section className={card}>
                <p className="text-xs uppercase font-bold tracking-wider text-foreground/60 mb-2">Meu porquê</p>
                <div className="flex gap-2">
                    <input value={porque} onChange={e => setPorque(e.target.value)} maxLength={120}
                        placeholder="Por que você está se organizando? Ex.: comprar a nossa casa até 2029"
                        className="flex-1 min-w-0 bg-surface border border-borders rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-green placeholder:text-foreground/30" />
                    {porque !== (meta.porque || "") && (
                        <button onClick={() => salvar({ porque: porque.trim() || null }, "Porquê salvo")} className="px-4 rounded-xl bg-brand-green text-background font-bold">Salvar</button>
                    )}
                </div>
                <p className="text-xs text-foreground/50 mt-2">Aparece no topo do Dashboard para lembrar o motivo de tudo isso.</p>
            </section>

            {user && <LembreteSemanal userId={user.id} />}

            {carregando ? <div className="p-6 text-foreground/50 animate-pulse">Calculando sua jornada...</div> : (
                <>
                    {/* Sequência */}
                    <section className={card}>
                        <div className="flex items-center justify-between">
                            <p className="text-xs uppercase font-bold tracking-wider text-foreground/60">Sequência</p>
                            <span className="text-xs text-foreground/50">recorde: {j.recorde} {j.recorde === 1 ? "semana" : "semanas"}</span>
                        </div>
                        <p className="mt-2 text-3xl font-bold text-white flex items-center gap-2">
                            <Flame className={`w-7 h-7 ${j.sequencia > 0 ? "text-brand-yellow" : "text-foreground/30"}`} />
                            {j.sequencia} {j.sequencia === 1 ? "semana" : "semanas"}
                            <span className="text-sm font-normal text-foreground/60">lançando sem falhar</span>
                        </p>
                        <div className="flex gap-1.5 mt-4">
                            {j.ultimas8.map((s, i) => (
                                <div key={s.semana} className="flex-1 text-center">
                                    <div className={`h-8 rounded-lg flex items-center justify-center ${s.ativa ? "bg-brand-green text-background" : i === 7 ? "border border-dashed border-borders" : "bg-surface"}`}>
                                        {s.ativa && <Check className="w-4 h-4" />}
                                    </div>
                                    <p className="text-[10px] text-foreground/50 mt-1">{s.semana.slice(8, 10)}/{s.semana.slice(5, 7)}</p>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-foreground/50 mt-3">
                            {j.estaSemanaAtiva ? "Esta semana já conta. " : "Lance algo esta semana para não perder a sequência. "}
                            Conta semanas com pelo menos um lançamento; o recorde fica guardado.
                        </p>
                    </section>

                    {/* Jornada */}
                    <section className={card}>
                        <p className="text-xs uppercase font-bold tracking-wider text-foreground/60 mb-3">Sua jornada</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <Numero valor={String(j.total)} rotulo="lançamentos" />
                            <Numero valor={`${j.azulSeguidos} ${j.azulSeguidos === 1 ? "mês" : "meses"}`} rotulo={j.azulSeguidos ? "seguidos no azul" : `no azul (recorde ${j.azulRecorde})`} />
                            <Numero valor={formatCurrency(j.totalGuardado)} rotulo="guardado nas caixinhas" cor="text-brand-blue" />
                            <Numero valor={`${j.mesesUsando} ${j.mesesUsando === 1 ? "mês" : "meses"}`} rotulo="usando o FinFamily" />
                        </div>
                    </section>

                    {/* Retrospectivas */}
                    <section className={card}>
                        <p className="text-xs uppercase font-bold tracking-wider text-foreground/60 mb-3 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-brand-green" />Retrospectivas</p>
                        <div className="flex flex-wrap gap-2">
                            {Array.from({ length: 6 }, (_, k) => mesDeslocado(mesDeHoje(), -1 - k)).map(m => (
                                <Link key={m} href={`/retrospectiva?mes=${m}`}
                                    className="px-3 py-1.5 rounded-full border border-borders bg-surface text-sm text-foreground/80 hover:text-white hover:border-brand-green">
                                    {MESES[Number(m.slice(5, 7)) - 1]}{m.slice(0, 4) !== String(new Date().getFullYear()) ? ` ${m.slice(0, 4)}` : ""}
                                </Link>
                            ))}
                        </div>
                        <p className="text-xs text-foreground/50 mt-3">O resumo de cada mês que fechou: quanto sobrou, para onde foi o dinheiro e o que dá para melhorar.</p>
                    </section>

                    {/* Conquistas */}
                    <section className={card}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs uppercase font-bold tracking-wider text-foreground/60">Conquistas</p>
                            <span className="text-xs text-foreground/50">{desbloqueadas} de {j.conquistas.length}</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                            {j.conquistas.map(c => {
                                const I = ICONES[c.icone] || Award;
                                const ok = c.progresso >= 1;
                                return (
                                    <button key={c.id} onClick={() => setConquistaAberta(conquistaAberta === c.id ? null : c.id)}
                                        className="rounded-xl border p-3 text-center transition-colors bg-surface"
                                        style={{ borderColor: conquistaAberta === c.id ? 'var(--brand-green)' : ok ? 'rgba(255,201,77,0.45)' : 'var(--borders)' }}>
                                        <I className={`w-6 h-6 mx-auto ${ok ? "text-brand-yellow" : "text-foreground/25"}`} />
                                        <p className={`text-[11px] mt-1.5 leading-tight ${ok ? "text-white" : "text-foreground/50"}`}>{c.titulo}</p>
                                        {!ok && (
                                            <div className="h-1 bg-borders rounded-full overflow-hidden mt-2">
                                                <div className="h-full bg-brand-green" style={{ width: `${Math.round(c.progresso * 100)}%` }} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {conquistaAberta && (() => {
                            const c = j.conquistas.find(x => x.id === conquistaAberta)!;
                            return <p className="text-sm text-foreground/80 mt-3"><b className="text-white">{c.titulo}:</b> {c.progresso >= 1 ? "desbloqueada. " : ""}{c.dica}</p>;
                        })()}
                    </section>
                </>
            )}
        </div>
    );
}

function Numero({ valor, rotulo, cor = "text-white" }: { valor: string; rotulo: string; cor?: string }) {
    return (
        <div className="min-w-0">
            <p className={`text-xl font-bold truncate ${cor}`}>{valor}</p>
            <p className="text-xs text-foreground/50">{rotulo}</p>
        </div>
    );
}
