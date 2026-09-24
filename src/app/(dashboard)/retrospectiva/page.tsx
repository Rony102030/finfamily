"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { formatCurrency } from "@/lib/format";
import { carregarCaixinhas } from "@/lib/caixinhas";
import { carregarFrangoLeitura } from "@/app/(dashboard)/negocio/data";
import { calcularRetrospectiva, Retrospectiva, mesDeslocado, mesDeHoje, nomeDoMes, LancRetro } from "@/lib/retrospectiva";
import {
    X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Trophy, Flame, PiggyBank, ShieldCheck, Target, Quote,
    Pencil, List, Sun, Crown, Award, RotateCcw, Drumstick, CalendarDays, Receipt, Sparkles,
} from "lucide-react";

const ICONES: Record<string, any> = { pencil: Pencil, list: List, sun: Sun, trophy: Trophy, crown: Crown, flame: Flame, piggy: PiggyBank, target: Target, shield: ShieldCheck, award: Award };
const brl = (n: number) => formatCurrency(n);
const dataCurta = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Cor de fundo de cada tela (brilho suave no topo)
const FUNDOS: Record<string, string> = {
    verde: 'radial-gradient(120% 70% at 20% 0%, rgba(0,229,160,0.28), transparent 60%), #000000',
    vermelho: 'radial-gradient(120% 70% at 20% 0%, rgba(255,77,77,0.28), transparent 60%), #000000',
    azul: 'radial-gradient(120% 70% at 80% 0%, rgba(77,159,255,0.30), transparent 60%), #000000',
    roxo: 'radial-gradient(120% 70% at 80% 0%, rgba(181,123,255,0.30), transparent 60%), #000000',
    amarelo: 'radial-gradient(120% 70% at 20% 0%, rgba(255,201,77,0.26), transparent 60%), #000000',
};

export default function RetrospectivaPage() {
    return <Suspense fallback={null}><Retro /></Suspense>;
}

function Retro() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useSearchParams();

    // só meses já fechados; sem ?mes= abre o mês passado
    const ultimoFechado = mesDeslocado(mesDeHoje(), -1);
    const pedido = params.get("mes");
    const mes = pedido && /^\d{4}-\d{2}$/.test(pedido) && pedido <= ultimoFechado ? pedido : ultimoFechado;

    const [r, setR] = useState<Retrospectiva | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [i, setI] = useState(0);

    useEffect(() => {
        if (!user) return;
        let vivo = true;
        setR(null); setI(0); setErro(null);
        (async () => {
            const tres = [mes, mesDeslocado(mes, -1), mesDeslocado(mes, -2)];
            const [lm, todos, cats, cx, frango] = await Promise.all([
                supabase.from('lancamentos').select('id, tipo, valor, mes, data, descricao, created_at, categorias(nome, cor)').eq('user_id', user.id).in('mes', tres).limit(5000),
                supabase.from('lancamentos').select('tipo, valor, mes, created_at, categorias(nome)').eq('user_id', user.id).limit(20000),
                supabase.from('categorias').select('nome, limite_mensal').eq('user_id', user.id).gt('limite_mensal', 0).order('created_at'),
                carregarCaixinhas(user.id, mes).catch(() => null),
                carregarFrangoLeitura(user.id).catch(() => null),
            ]);
            if (lm.error) throw lm.error;
            const res = calcularRetrospectiva({
                mes,
                lancsMes: (lm.data || []).map((x: any) => ({ ...x, valor: Number(x.valor) })) as LancRetro[],
                jornada: (todos.data || []).map((x: any) => ({ ...x, valor: Number(x.valor) })),
                categoriasComLimite: (cats.data || []).map((c: any) => ({ nome: c.nome, limite_mensal: Number(c.limite_mensal) })),
                cx, frango,
            });
            if (vivo) setR(res);
        })().catch(e => vivo && setErro(e?.message || "Erro ao carregar"));
        return () => { vivo = false; };
    }, [user?.id, mes]);

    const telas = useMemo(() => (r ? montarTelas(r) : []), [r]);
    const total = telas.length;
    const ir = useCallback((n: number) => setI(x => Math.max(0, Math.min(total - 1, x + n))), [total]);
    const fechar = () => router.push("/dashboard");

    useEffect(() => {
        const tecla = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); ir(1); }
            else if (e.key === "ArrowLeft") ir(-1);
            else if (e.key === "Escape") fechar();
        };
        window.addEventListener("keydown", tecla);
        return () => window.removeEventListener("keydown", tecla);
    }, [ir]);

    const trocarMes = (novo: string) => router.replace(`/retrospectiva?mes=${novo}`);
    const opcoesMes = Array.from({ length: 12 }, (_, k) => mesDeslocado(ultimoFechado, -k));

    const tela = telas[i];
    const tocar = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("button, a, select")) return;
        const box = e.currentTarget.getBoundingClientRect();
        ir(e.clientX - box.left < box.width * 0.3 ? -1 : 1);
    };

    return (
        <div className="fixed inset-0 z-[60] bg-background flex items-center justify-center sm:p-6">
            <div className="relative w-full h-full sm:h-[min(92vh,820px)] sm:max-w-[430px] sm:rounded-3xl overflow-hidden sm:border sm:border-borders select-none"
                style={{ background: tela ? FUNDOS[tela.fundo] : '#000000' }}>

                {/* barras de progresso e topo */}
                <div className="absolute top-0 inset-x-0 z-20 px-4 pt-4 pb-2" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                    <div className="flex gap-1">
                        {telas.map((_, k) => (
                            <button key={k} onClick={() => setI(k)} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.18)' }} aria-label={`Tela ${k + 1}`}>
                                <div className="h-full bg-white transition-all duration-300" style={{ width: k <= i ? '100%' : '0%' }} />
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                        <p className="text-xs font-bold tracking-wider uppercase text-white/70">Retrospectiva · {nomeDoMes(mes)} {mes.slice(0, 4)}</p>
                        <button onClick={fechar} className="p-1.5 -mr-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10" aria-label="Fechar"><X className="w-6 h-6" /></button>
                    </div>
                </div>

                {/* conteúdo */}
                <div className="absolute inset-0 pt-24 pb-16 px-6 flex flex-col overflow-y-auto cursor-pointer" onClick={tocar}>
                    {erro ? <p className="m-auto text-brand-red text-center">{erro}</p>
                        : !r ? <p className="m-auto text-white/60 animate-pulse">Montando a sua retrospectiva...</p>
                            : (
                                <div key={`${mes}-${i}`} className="my-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {tela?.id === 'capa'
                                        ? <Capa r={r} user={user} mes={mes} opcoes={opcoesMes} onMes={trocarMes} />
                                        : tela?.id === 'fim'
                                            ? <Fim r={r} user={user} onDeNovo={() => setI(0)} onFechar={fechar} />
                                            : tela?.conteudo}
                                </div>
                            )}
                </div>

                {/* rodapé */}
                {r && (
                    <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-4 flex items-center justify-between text-white/60" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                        <button onClick={() => ir(-1)} disabled={i === 0} className="p-2 rounded-full hover:bg-white/10 disabled:opacity-0" aria-label="Anterior"><ChevronLeft className="w-6 h-6" /></button>
                        <span className="text-xs">{i === 0 ? "toque para avançar" : `${i + 1} de ${total}`}</span>
                        <button onClick={() => ir(1)} disabled={i === total - 1} className="p-2 rounded-full hover:bg-white/10 disabled:opacity-0" aria-label="Próxima"><ChevronRight className="w-6 h-6" /></button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- telas

type Tela = { id: string; fundo: keyof typeof FUNDOS; conteudo?: React.ReactNode };

function montarTelas(r: Retrospectiva): Tela[] {
    const mesNome = nomeDoMes(r.mes);
    const antNome = nomeDoMes(r.anterior);
    const t: Tela[] = [{ id: 'capa', fundo: 'verde' }];

    if (!r.temDados) {
        t.push({ id: 'vazio', fundo: 'amarelo', conteudo: (
            <>
                <Rotulo>Mês sem lançamentos</Rotulo>
                <Grande>Nada lançado em {mesNome}.</Grande>
                <Texto>Quando você lança os gastos e receitas do mês, a retrospectiva mostra para onde foi o dinheiro, o que melhorou e o que dá para ajustar.</Texto>
            </>
        ) });
        t.push({ id: 'fim', fundo: 'verde' });
        return t;
    }

    // Quanto sobrou
    const azul = r.sobra >= 0;
    const diffSobra = r.sobraAnterior === null ? null : r.sobra - r.sobraAnterior;
    t.push({ id: 'sobra', fundo: azul ? 'verde' : 'vermelho', conteudo: (
        <>
            <Rotulo>{azul ? `Sobrou em ${mesNome}` : `${cap(mesNome)} fechou no vermelho`}</Rotulo>
            <p className={`text-5xl font-bold tracking-tight mt-3 ${azul ? "text-brand-green" : "text-brand-red"}`}>{azul ? "" : "−"}{brl(Math.abs(r.sobra))}</p>
            {diffSobra !== null && Math.abs(diffSobra) >= 1 && (
                <p className="mt-3 text-lg text-white/85 flex items-center gap-2">
                    {diffSobra > 0 ? <TrendingUp className="w-5 h-5 text-brand-green" /> : <TrendingDown className="w-5 h-5 text-brand-red" />}
                    {brl(Math.abs(diffSobra))} {diffSobra > 0 ? "a mais" : "a menos"} que em {antNome}
                </p>
            )}
            <div className="mt-8 space-y-2.5">
                <Linha rotulo="Renda" valor={brl(r.renda)} />
                <Linha rotulo="Guardado nas caixinhas" valor={`− ${brl(r.guardado)}`} cor="text-brand-blue" />
                <Linha rotulo="Gastos do mês" valor={`− ${brl(r.despesas)}`} cor="text-brand-red" />
            </div>
            {azul && r.azulSeguidos >= 2 && (
                <Destaque><Trophy className="w-5 h-5 text-brand-yellow flex-shrink-0" /> {r.azulSeguidos} meses seguidos no azul!</Destaque>
            )}
            {azul && r.azulSeguidos < 2 && <Texto>Mês no azul: você gastou menos do que tinha para gastar.</Texto>}
            {!azul && <Texto>Mês no vermelho não é fracasso. É informação para o próximo.</Texto>}
        </>
    ) });

    // Para onde foi
    if (r.top.length) t.push({ id: 'categorias', fundo: 'roxo', conteudo: (
        <>
            <Rotulo>Para onde foi o dinheiro</Rotulo>
            <Grande>{r.top[0].nome} levou {Math.round(r.top[0].pct * 100)}% dos gastos.</Grande>
            <div className="mt-8 space-y-5">
                {r.top.map((c, k) => (
                    <div key={c.nome}>
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-white text-lg truncate"><span className="text-white/40 mr-2">{k + 1}</span>{c.nome}</span>
                            <span className="text-white font-bold whitespace-nowrap">{brl(c.valor)}</span>
                        </div>
                        <div className="h-2.5 rounded-full mt-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.round(c.pct * 100))}%`, background: c.cor || '#b57bff' }} />
                        </div>
                        <p className="text-xs text-white/50 mt-1">{Math.round(c.pct * 100)}% dos gastos</p>
                    </div>
                ))}
            </div>
            {r.totalCategorias > 3 && <Texto>Ao todo, {r.totalCategorias} categorias somaram {brl(r.despesas)}.</Texto>}
        </>
    ) });

    // Subiu e caiu
    if (r.subiu || r.caiu) t.push({ id: 'variacao', fundo: 'amarelo', conteudo: (
        <>
            <Rotulo>Comparado com {antNome}</Rotulo>
            {r.caiu && (
                <div className="mt-4">
                    <p className="text-brand-green font-bold flex items-center gap-2"><TrendingDown className="w-5 h-5" /> A vitória do mês</p>
                    <Grande>{r.caiu.nome} caiu {brl(Math.abs(r.caiu.diff))}.</Grande>
                    <p className="text-white/60 mt-1">{brl(r.caiu.anterior)} em {antNome} → {brl(r.caiu.atual)} em {mesNome}</p>
                </div>
            )}
            {r.subiu && (
                <div className="mt-10">
                    <p className="text-brand-red font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Ponto de atenção</p>
                    <Grande>{r.subiu.nome} subiu {brl(r.subiu.diff)}.</Grande>
                    <p className="text-white/60 mt-1">{brl(r.subiu.anterior)} em {antNome} → {brl(r.subiu.atual)} em {mesNome}</p>
                </div>
            )}
        </>
    ) });

    // Limites
    if (r.limites.total > 0) {
        const todas = r.limites.dentro === r.limites.total;
        t.push({ id: 'limites', fundo: todas ? 'verde' : 'amarelo', conteudo: (
            <>
                <Rotulo>Limites por categoria</Rotulo>
                <p className="text-6xl font-bold text-white mt-3">{r.limites.dentro}<span className="text-white/40 text-4xl"> de {r.limites.total}</span></p>
                <Texto>{todas ? "Todas as categorias com limite ficaram dentro dele. Mandou bem!" : `categorias ficaram dentro do limite.`}</Texto>
                {r.limites.estouradas.length > 0 && (
                    <div className="mt-6 space-y-3">
                        <p className="text-xs uppercase font-bold tracking-wider text-white/50">Passaram do limite</p>
                        {r.limites.estouradas.map(l => (
                            <div key={l.nome} className="flex items-baseline justify-between gap-3">
                                <span className="text-white truncate">{l.nome}</span>
                                <span className="text-brand-red font-bold whitespace-nowrap">+{brl(l.valor - l.limite)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </>
        ) });
    }

    // Curiosidades
    if (r.maiorGasto) t.push({ id: 'curiosidades', fundo: 'azul', conteudo: (
        <>
            <Rotulo>Curiosidades de {mesNome}</Rotulo>
            <div className="mt-5 space-y-6">
                <Curiosidade icone={<Receipt className="w-5 h-5" />} titulo="Maior gasto"
                    valor={brl(r.maiorGasto.valor)} detalhe={`${r.maiorGasto.descricao}${r.maiorGasto.data ? ` · ${dataCurta(r.maiorGasto.data)}` : ""}`} />
                {r.diaDaSemana && (
                    <Curiosidade icone={<CalendarDays className="w-5 h-5" />} titulo="Dia da semana mais caro"
                        valor={cap(r.diaDaSemana.nome)} detalhe={`${brl(r.diaDaSemana.valor)} gastos às ${r.diaDaSemana.nome}s`} />
                )}
                <Curiosidade icone={<Sparkles className="w-5 h-5" />} titulo="Dias sem gastar nada"
                    valor={`${r.diasSemGasto} ${r.diasSemGasto === 1 ? "dia" : "dias"}`} detalhe={`de ${r.ultimoDia} no mês`} />
            </div>
        </>
    ) });

    // Caixinhas
    const cx = r.caixinhas;
    if (cx && (cx.guardado !== 0 || cx.reservaCobre !== null)) t.push({ id: 'caixinhas', fundo: 'azul', conteudo: (
        <>
            <Rotulo>Caixinhas</Rotulo>
            {cx.guardado > 0
                ? <><p className="text-5xl font-bold text-brand-blue mt-3">{brl(cx.guardado)}</p><Texto>guardados em {mesNome}. Dinheiro que agora trabalha para você.</Texto></>
                : cx.guardado < 0
                    ? <><p className="text-5xl font-bold text-white mt-3">{brl(Math.abs(cx.guardado))}</p><Texto>resgatados das caixinhas em {mesNome}.</Texto></>
                    : <Grande>Nada guardado em {mesNome}.</Grande>}
            {cx.porCaixinha.length > 0 && (
                <div className="mt-6 space-y-2.5">
                    {cx.porCaixinha.map(c => <Linha key={c.nome} rotulo={c.nome} valor={`${c.valor > 0 ? "+" : "−"} ${brl(Math.abs(c.valor))}`} cor={c.valor > 0 ? "text-brand-blue" : "text-white/70"} />)}
                </div>
            )}
            {cx.reservaCobre !== null && (
                <div className="mt-8 rounded-2xl p-4 border" style={{ background: 'rgba(77,159,255,0.08)', borderColor: 'rgba(77,159,255,0.35)' }}>
                    <p className="text-sm text-white/80 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brand-blue" />Hoje, a reserva de emergência cobre</p>
                    <p className="text-2xl font-bold text-white mt-1">{cx.reservaCobre.toFixed(1).replace('.', ',')} {cx.reservaCobre >= 1 && cx.reservaCobre < 2 ? "mês" : "meses"} <span className="text-sm font-normal text-white/50">de 6 ideais</span></p>
                    <div className="h-2 rounded-full mt-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <div className="h-full rounded-full bg-brand-blue" style={{ width: `${Math.min(100, Math.round(cx.reservaCobre / 6 * 100))}%` }} />
                    </div>
                </div>
            )}
        </>
    ) });

    // Hábito
    t.push({ id: 'habito', fundo: 'amarelo', conteudo: (
        <>
            <Rotulo>Seu hábito</Rotulo>
            <p className="text-6xl font-bold text-white mt-3">{r.lancamentos}</p>
            <Texto>lançamentos em {mesNome}.</Texto>
            <div className="mt-6 flex items-center gap-3">
                <Flame className="w-8 h-8 text-brand-yellow" />
                <p className="text-white text-lg">Você lançou em <b>{r.semanasAtivas} de {r.semanasDoMes}</b> semanas do mês.</p>
            </div>
            {r.conquistasNovas.length > 0 && (
                <div className="mt-8">
                    <p className="text-xs uppercase font-bold tracking-wider text-white/50 mb-3">Conquistas desbloqueadas</p>
                    <div className="flex flex-wrap gap-2">
                        {r.conquistasNovas.map(c => {
                            const I = ICONES[c.icone] || Award;
                            return (
                                <span key={c.id} className="flex items-center gap-2 rounded-full px-3 py-1.5 border text-sm text-white" style={{ borderColor: 'rgba(255,201,77,0.45)', background: 'rgba(255,201,77,0.08)' }}>
                                    <I className="w-4 h-4 text-brand-yellow" /> {c.titulo}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    ) });

    // Hora do Frango
    const f = r.frango;
    if (f) t.push({ id: 'frango', fundo: f.lucro >= 0 ? 'amarelo' : 'vermelho', conteudo: (
        <>
            <Rotulo><Drumstick className="w-4 h-4 inline -mt-0.5 mr-1" />Hora do Frango</Rotulo>
            <p className={`text-5xl font-bold mt-3 ${f.lucro >= 0 ? "text-brand-green" : "text-brand-red"}`}>{f.lucro < 0 ? "−" : ""}{brl(Math.abs(f.lucro))}</p>
            <Texto>de lucro em {mesNome}, com {f.vendidos} frangos vendidos em {f.dias} {f.dias === 1 ? "dia" : "dias"} de venda.</Texto>
            <div className="mt-6 space-y-2.5">
                <Linha rotulo="Receita" valor={brl(f.receita)} />
                {f.margemPorFrango !== null && <Linha rotulo="Lucro por frango" valor={brl(f.margemPorFrango)} />}
                {f.melhorDia && <Linha rotulo="Melhor dia" valor={`${dataCurta(f.melhorDia.data)} · ${f.melhorDia.vendidos} frangos`} />}
            </div>
            {f.meta > 0 && (
                <div className="mt-6">
                    <div className="flex justify-between text-sm text-white/70"><span>Meta do mês</span><span>{f.vendidos} de {f.meta}</span></div>
                    <div className="h-2 rounded-full mt-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <div className="h-full rounded-full bg-brand-yellow" style={{ width: `${Math.min(100, Math.round(f.vendidos / f.meta * 100))}%` }} />
                    </div>
                </div>
            )}
        </>
    ) });

    t.push({ id: 'fim', fundo: 'verde' });
    return t;
}

function Capa({ r, user, mes, opcoes, onMes }: { r: Retrospectiva; user: any; mes: string; opcoes: string[]; onMes: (m: string) => void }) {
    const meta = user?.user_metadata || {};
    const nome = meta.display_name || "";
    return (
        <div className="text-center">
            {meta.avatar_url
                ? <img src={meta.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-brand-green mx-auto" />
                : <div className="w-24 h-24 rounded-full border-2 border-brand-green mx-auto flex items-center justify-center text-4xl font-bold text-brand-green" style={{ background: 'rgba(0,229,160,0.12)' }}>{(nome || user?.email || "U").charAt(0).toUpperCase()}</div>}
            <p className="text-white/70 mt-6">{nome ? `${nome}, este foi o seu` : "Este foi o seu"}</p>
            <h1 className="font-heading font-bold text-6xl text-white mt-1">{cap(nomeDoMes(r.mes))}</h1>
            <p className="text-white/50 mt-1">{r.mes.slice(0, 4)}</p>
            <p className="text-white/80 mt-8 max-w-xs mx-auto">Em poucos toques: quanto sobrou, para onde foi o dinheiro e o que dá para melhorar.</p>
            <select value={mes} onChange={e => onMes(e.target.value)} className="mt-8 bg-transparent border rounded-xl px-3 py-2 text-sm text-white/80" style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
                {opcoes.map(m => <option key={m} value={m} className="bg-background">{cap(nomeDoMes(m))} {m.slice(0, 4)}</option>)}
            </select>
        </div>
    );
}

function Fim({ r, user, onDeNovo, onFechar }: { r: Retrospectiva; user: any; onDeNovo: () => void; onFechar: () => void }) {
    const porque = user?.user_metadata?.porque;
    return (
        <>
            <Rotulo>Para {nomeDoMes(mesDeslocado(r.mes, 1))}</Rotulo>
            {r.sugestao && <p className="text-2xl font-heading font-bold text-white leading-snug mt-3">{r.sugestao}</p>}
            {porque && (
                <div className="mt-8 rounded-2xl p-4 border" style={{ background: 'rgba(255,201,77,0.07)', borderColor: 'rgba(255,201,77,0.35)' }}>
                    <p className="text-xs uppercase font-bold tracking-wider text-brand-yellow flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />Lembre do seu porquê</p>
                    <p className="text-white text-lg mt-1">{porque}</p>
                </div>
            )}
            <p className="text-white/70 mt-8 flex gap-2 italic"><Quote className="w-4 h-4 flex-shrink-0 mt-1 text-white/40" />{r.frase}</p>
            <div className="mt-10 flex flex-col gap-2">
                <button onClick={onFechar} className="py-3 rounded-xl bg-brand-green text-background font-bold">Ir para o Dashboard</button>
                <button onClick={onDeNovo} className="py-3 rounded-xl border text-white/80 flex items-center justify-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
                    <RotateCcw className="w-4 h-4" /> Ver de novo
                </button>
                {!porque && <Link href="/perfil" className="text-center text-sm text-brand-yellow mt-2">Escreva o seu porquê no Perfil</Link>}
            </div>
        </>
    );
}

// ---------------------------------------------------------------- peças

function Rotulo({ children }: { children: React.ReactNode }) {
    return <p className="text-xs uppercase font-bold tracking-wider text-white/60">{children}</p>;
}
function Grande({ children }: { children: React.ReactNode }) {
    return <p className="text-3xl font-heading font-bold text-white leading-tight mt-3">{children}</p>;
}
function Texto({ children }: { children: React.ReactNode }) {
    return <p className="text-white/75 text-lg mt-3 leading-snug">{children}</p>;
}
function Linha({ rotulo, valor, cor = "text-white" }: { rotulo: string; valor: string; cor?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3 border-b pb-2.5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <span className="text-white/70 truncate">{rotulo}</span>
            <span className={`font-bold whitespace-nowrap ${cor}`}>{valor}</span>
        </div>
    );
}
function Destaque({ children }: { children: React.ReactNode }) {
    return <p className="mt-8 rounded-2xl p-4 border text-white flex items-center gap-2" style={{ background: 'rgba(0,229,160,0.08)', borderColor: 'rgba(0,229,160,0.35)' }}>{children}</p>;
}
function Curiosidade({ icone, titulo, valor, detalhe }: { icone: React.ReactNode; titulo: string; valor: string; detalhe: string }) {
    return (
        <div className="flex gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-brand-blue flex-shrink-0" style={{ background: 'rgba(77,159,255,0.12)' }}>{icone}</span>
            <div className="min-w-0">
                <p className="text-sm text-white/60">{titulo}</p>
                <p className="text-2xl font-bold text-white">{valor}</p>
                <p className="text-sm text-white/60 truncate">{detalhe}</p>
            </div>
        </div>
    );
}
