"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { formatMonth } from "@/lib/format";
import { Eye, EyeOff, Plus, ArrowUpCircle, PiggyBank, List, TrendingUp, TrendingDown, ShieldCheck, ChevronRight, Target, Sparkles, X } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid, LabelList } from 'recharts';
import { DateRangePicker } from "@/components/DateRangePicker";
import { TransactionModal } from "@/components/TransactionModal";
import { carregarCaixinhas, guardadoNoMes, saldoCaixinha, isEmergenciaNome, DadosCaixinhas } from "@/lib/caixinhas";

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const nomeMes = (mes: string) => formatMonth(mes).split(" ")[0].toLowerCase();

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Mesma regra de sempre: a categoria antiga "Fundos" e os gastos pagos com a reserva (Emergência) não são despesa do mês.
const foraDasDespesas = (nome?: string | null) => (nome || "").toLowerCase() === 'fundos' || isEmergenciaNome(nome);

function mesDeslocado(mes: string, delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const diasNoMes = (mes: string) => { const [y, m] = mes.split("-").map(Number); return new Date(y, m, 0).getDate(); };
function hojeLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Gasto acumulado dia a dia (índice 1..último dia). */
function acumulado(txs: any[], mes: string) {
    const dias = diasNoMes(mes);
    const porDia = Array(dias + 1).fill(0);
    for (const t of txs) {
        if (t.tipo !== 'despesa' || foraDasDespesas(t.categorias?.nome) || !t.data) continue;
        const dia = Number(t.data.slice(8, 10));
        if (dia >= 1 && dia <= dias) porDia[dia] += t.valor;
    }
    for (let i = 1; i <= dias; i++) porDia[i] += porDia[i - 1];
    return porDia;
}

export default function DashboardPage() {
    const { user } = useAuth();
    const { activeMonth } = useAppStore();

    const [loading, setLoading] = useState(true);
    const [showValues, setShowValues] = useState(true);
    const [txs, setTxs] = useState<any[]>([]);
    const [prevTxs, setPrevTxs] = useState<any[]>([]);
    const [trendTxs, setTrendTxs] = useState<any[]>([]);
    const [caixinhas, setCaixinhas] = useState<DadosCaixinhas | null>(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [modal, setModal] = useState<null | 'despesa' | 'renda'>(null);
    const [todasCategorias, setTodasCategorias] = useState(false);
    const [retroFechada, setRetroFechada] = useState(true);

    const last6 = useMemo(() => Array.from({ length: 6 }, (_, i) => mesDeslocado(activeMonth, i - 5)), [activeMonth]);
    const prevMonth = mesDeslocado(activeMonth, -1);

    // Nos 7 primeiros dias do mês, um cartão chama para a retrospectiva do mês que fechou.
    const hojeData = new Date();
    const mesPassado = mesDeslocado(hojeLocal().slice(0, 7), -1);
    const chaveRetro = `ff-retro-fechada-${mesPassado}`;
    useEffect(() => {
        if (hojeData.getDate() > 7) return;
        try { setRetroFechada(localStorage.getItem(chaveRetro) === "1"); } catch { setRetroFechada(false); }
    }, [chaveRetro]);
    const fecharRetro = () => {
        setRetroFechada(true);
        try { localStorage.setItem(chaveRetro, "1"); } catch { }
    };

    useEffect(() => {
        if (user && activeMonth) fetchData();
    }, [user, activeMonth]);

    const fetchData = async () => {
        setLoading(true);
        const [currentRes, prevRes, trendRes, cx] = await Promise.all([
            supabase.from('lancamentos').select('*, categorias(nome, cor, limite_mensal)').eq('user_id', user!.id).eq('mes', activeMonth),
            supabase.from('lancamentos').select('tipo, valor, data, categorias(nome)').eq('user_id', user!.id).eq('mes', prevMonth),
            supabase.from('lancamentos').select('mes, tipo, valor, categorias(nome)').eq('user_id', user!.id).in('mes', last6),
            carregarCaixinhas(user!.id, activeMonth).catch(() => null),
        ]);
        setTxs(currentRes.data || []);
        setPrevTxs(prevRes.data || []);
        setTrendTxs(trendRes.data || []);
        setCaixinhas(cx);
        setLoading(false);
    };

    // ---------------- ritmo de gastos (antes de qualquer return) ----------------
    const acAtual = useMemo(() => acumulado(txs, activeMonth), [txs, activeMonth]);
    const acAnterior = useMemo(() => acumulado(prevTxs, prevMonth), [prevTxs, prevMonth]);

    const v = (n: number) => showValues ? formatCurrency(n) : '••••••';

    // ---------------- números do mês ----------------
    const filtrado = !!(startDate || endDate);
    const filteredTxs = txs.filter(t => {
        if (!filtrado || !t.data) return true;
        if (startDate && t.data < startDate) return false;
        if (endDate && t.data > endDate) return false;
        return true;
    });

    let rendaBruta = 0, despesas = 0;
    const porCategoria: Record<string, { nome: string; cor: string; valor: number; limite: number }> = {};
    for (const t of filteredTxs) {
        if (t.tipo === 'renda') { rendaBruta += t.valor; continue; }
        if (foraDasDespesas(t.categorias?.nome)) continue;
        despesas += t.valor;
        const nome = t.categorias?.nome || "Sem categoria";
        porCategoria[nome] ??= { nome, cor: t.categorias?.cor || '#4d9fff', valor: 0, limite: t.categorias?.limite_mensal || 0 };
        porCategoria[nome].valor += t.valor;
    }
    const movimentos = caixinhas?.movimentos || [];
    const guardado = guardadoNoMes(movimentos, activeMonth);
    const liquido = rendaBruta - guardado;
    const sobra = liquido - despesas;
    const pctUsado = liquido > 0 ? despesas / liquido : (despesas > 0 ? 1 : 0);
    const categorias = Object.values(porCategoria).sort((a, b) => b.valor - a.valor);

    // ---------------- mês atual, passado ou futuro ----------------
    const hoje = hojeLocal();
    const mesHoje = hoje.slice(0, 7);
    const ultimoDia = diasNoMes(activeMonth);
    const ehMesAtual = activeMonth === mesHoje;
    const diaRef = ehMesAtual ? Number(hoje.slice(8, 10)) : ultimoDia;
    const diasRestantes = ehMesAtual ? ultimoDia - diaRef + 1 : 0;

    let heroTitulo: string;
    if (filtrado) heroTitulo = "Sobra no período";
    else if (sobra < 0) heroTitulo = `Passou do líquido em ${nomeMes(activeMonth)}`;
    else if (ehMesAtual) heroTitulo = `Ainda dá pra gastar em ${nomeMes(activeMonth)}`;
    else if (activeMonth < mesHoje) heroTitulo = `Sobrou em ${nomeMes(activeMonth)}`;
    else heroTitulo = `Previsto para ${nomeMes(activeMonth)}`;
    const heroCor = sobra < 0 ? "text-brand-red" : pctUsado >= 0.9 ? "text-brand-yellow" : "text-brand-green";
    const barraCor = sobra < 0 ? "bg-brand-red" : pctUsado >= 0.9 ? "bg-brand-yellow" : "bg-brand-green";

    const diaComparado = Math.min(diaRef, acAnterior.length - 1);
    const gastoAteHoje = acAtual[diaRef] || 0;
    const gastoAnteriorAteDia = acAnterior[diaComparado] || 0;
    const diffRitmo = gastoAnteriorAteDia > 0 ? (gastoAteHoje - gastoAnteriorAteDia) / gastoAnteriorAteDia : null;
    const ritmoData = Array.from({ length: Math.max(ultimoDia, acAnterior.length - 1) }, (_, i) => {
        const dia = i + 1;
        return {
            dia,
            atual: dia <= diaRef && dia <= ultimoDia ? acAtual[dia] : null,
            anterior: dia < acAnterior.length ? acAnterior[dia] : null,
        };
    });

    // ---------------- sobra por mês ----------------
    const sobraPorMes = last6.map(m => {
        let r = 0, d = 0;
        for (const t of trendTxs) {
            if (t.mes !== m) continue;
            if (t.tipo === 'renda') r += t.valor;
            else if (!foraDasDespesas(t.categorias?.nome)) d += t.valor;
        }
        return { mes: m, rotulo: MESES_CURTOS[Number(m.slice(5, 7)) - 1], sobra: Math.round((r - guardadoNoMes(movimentos, m) - d) * 100) / 100 };
    });

    // ---------------- caixinhas ----------------
    const totalCaixinhas = caixinhas ? caixinhas.caixinhas.reduce((s, c) => s + saldoCaixinha(c, caixinhas.movimentos, caixinhas.gastos), 0) : 0;
    const emergencia = caixinhas?.caixinhas.find(c => c.tipo === 'emergencia');
    const saldoEmergencia = emergencia && caixinhas ? saldoCaixinha(emergencia, caixinhas.movimentos, caixinhas.gastos) : 0;
    const mesesCobre = caixinhas && caixinhas.mediaDespesas > 0 ? saldoEmergencia / caixinhas.mediaDespesas : null;
    const outrasCaixinhas = caixinhas ? caixinhas.caixinhas.filter(c => !c.arquivada && c.tipo !== 'emergencia').slice(0, 3) : [];

    // ---------------- últimos lançamentos ----------------
    const ultimos = [...filteredTxs]
        .sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.created_at || "").localeCompare(a.created_at || ""))
        .slice(0, 5);

    if (loading) return <div className="p-8 text-foreground/50 animate-pulse">Calculando dashboard...</div>;

    const nome = user?.user_metadata?.display_name;
    const alertasOrcamento = categorias.filter(c => c.limite > 0 && c.valor >= c.limite * 0.8).length;
    const card = "bg-cards border border-borders rounded-2xl p-4 sm:p-5";

    return (
        <div className="space-y-5 animate-in fade-in duration-500 max-w-6xl mx-auto">
            {/* Cabeçalho compacto */}
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm text-foreground/60">{nome ? `Olá, ${nome}` : "Olá"}</p>
                    {user?.user_metadata?.porque && (
                        <Link href="/perfil" className="text-xs text-brand-yellow hover:underline flex items-center gap-1 mt-0.5">
                            <Target className="w-3.5 h-3.5" /> {user.user_metadata.porque}
                        </Link>
                    )}
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-heading font-bold text-white tracking-tight">{formatMonth(activeMonth)}</h1>
                        <button onClick={() => setShowValues(!showValues)} className="p-1.5 rounded-lg text-foreground/60 hover:text-white hover:bg-white/5" title={showValues ? "Ocultar valores" : "Mostrar valores"}>
                            {showValues ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                <div className="w-full sm:w-auto">
                    <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s: string, e: string) => { setStartDate(s); setEndDate(e); }} />
                </div>
            </header>

            {!retroFechada && (
                <div className="rounded-2xl p-4 border flex items-center gap-3" style={{ background: 'linear-gradient(90deg, rgba(0,229,160,0.14), rgba(181,123,255,0.12))', borderColor: 'rgba(0,229,160,0.4)' }}>
                    <Sparkles className="w-6 h-6 text-brand-green flex-shrink-0" />
                    <Link href={`/retrospectiva?mes=${mesPassado}`} onClick={fecharRetro} className="flex-1 min-w-0">
                        <p className="font-bold text-white">Sua retrospectiva de {nomeMes(mesPassado)} está pronta</p>
                        <p className="text-xs text-foreground/70">Quanto sobrou, para onde foi o dinheiro e o que dá para melhorar.</p>
                    </Link>
                    <Link href={`/retrospectiva?mes=${mesPassado}`} onClick={fecharRetro} className="hidden sm:block text-sm font-bold py-2 px-4 rounded-xl bg-brand-green text-background">Ver agora</Link>
                    <button onClick={fecharRetro} className="p-1.5 rounded-lg text-foreground/50 hover:text-white" title="Dispensar"><X className="w-4 h-4" /></button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Principal: quanto ainda dá pra gastar */}
                <section className={`${card} lg:col-span-2 lg:row-span-2 lg:col-start-1 lg:row-start-1 flex flex-col`}>
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs uppercase font-bold tracking-wider text-foreground/60">{heroTitulo}</p>
                        {ehMesAtual && !filtrado && <span className="text-xs px-2.5 py-1 rounded-full bg-surface border border-borders text-foreground/70 whitespace-nowrap">{diasRestantes === 1 ? "último dia" : `faltam ${diasRestantes} dias`}</span>}
                    </div>
                    <p className={`mt-2 text-4xl lg:text-5xl font-bold tracking-tight ${heroCor}`}>{v(Math.abs(sobra))}</p>
                    {ehMesAtual && !filtrado && sobra > 0 && (
                        <p className="text-sm text-foreground/60 mt-1">≈ {v(sobra / diasRestantes)} por dia até o dia {ultimoDia}</p>
                    )}
                    <div className="mt-5">
                        <div className="h-2.5 bg-surface rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barraCor}`} style={{ width: `${Math.min(100, Math.round(pctUsado * 100))}%` }} />
                        </div>
                        <div className="flex justify-between gap-2 text-xs text-foreground/60 mt-1.5">
                            <span>Gasto {v(despesas)} ({Math.round(pctUsado * 100)}%)</span>
                            <span className="text-right">de {v(liquido)} líquido p/ gastos</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-5 lg:mt-auto pt-5 border-t border-borders">
                        <Mini label="Renda" valor={v(rendaBruta)} />
                        <Mini label="Guardado" valor={v(guardado)} cor="text-brand-blue" />
                        <Mini label="Gasto" valor={v(despesas)} cor="text-brand-red" />
                    </div>
                </section>

                {/* Ações rápidas */}
                <section className={`${card} lg:col-start-3 lg:row-start-1 grid grid-cols-4 gap-2`}>
                    <Acao onClick={() => setModal('despesa')} icone={<Plus className="w-5 h-5" />} label="Despesa" />
                    <Acao onClick={() => setModal('renda')} icone={<ArrowUpCircle className="w-5 h-5" />} label="Receita" />
                    <Acao href="/caixinhas" icone={<PiggyBank className="w-5 h-5" />} label="Guardar" />
                    <Acao href="/lancamentos" icone={<List className="w-5 h-5" />} label="Extrato" />
                </section>

                {/* Ritmo em uma frase */}
                <section className="rounded-2xl p-4 border lg:col-span-3 lg:row-start-3 flex items-start gap-3 text-sm"
                    style={diffRitmo !== null && diffRitmo > 0.05 ? { background: 'rgba(255,77,77,0.06)', borderColor: 'rgba(255,77,77,0.35)' } : { background: 'var(--cards)', borderColor: 'var(--borders)' }}>
                    {diffRitmo !== null && diffRitmo > 0
                        ? <TrendingUp className="w-5 h-5 text-brand-red flex-shrink-0" />
                        : <TrendingDown className="w-5 h-5 text-brand-green flex-shrink-0" />}
                    <p className="text-foreground/85">
                        {diffRitmo === null
                            ? <>Sem gastos em {nomeMes(prevMonth)} para comparar o ritmo.</>
                            : <>{ehMesAtual ? `Até o dia ${diaRef}` : `Em ${nomeMes(activeMonth)}`} você gastou{" "}
                                <b className={diffRitmo > 0 ? "text-brand-red" : "text-brand-green"}>{Math.abs(Math.round(diffRitmo * 100))}% {diffRitmo > 0 ? "a mais" : "a menos"}</b>{" "}
                                que em {nomeMes(prevMonth)} ({v(gastoAteHoje)} × {v(gastoAnteriorAteDia)}).</>}
                    </p>
                </section>

                {/* Categorias */}
                <section className={`${card} lg:col-start-3 lg:row-start-4`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-heading font-bold text-white">Onde foi o dinheiro</h3>
                        {alertasOrcamento > 0 && <span className="text-xs font-bold text-brand-yellow">{alertasOrcamento} perto do limite</span>}
                    </div>
                    {categorias.length === 0 ? <p className="text-sm text-foreground/50">Nenhuma despesa no período.</p> : (
                        <div className="space-y-3">
                            {(todasCategorias ? categorias : categorias.slice(0, 5)).map(c => {
                                const comLimite = c.limite > 0;
                                const pct = comLimite ? c.valor / c.limite : c.valor / categorias[0].valor;
                                const cor = comLimite ? (pct >= 1 ? "#ff4d4d" : pct >= 0.8 ? "#ffc94d" : "#00e5a0") : (c.cor || "#00e5a0");
                                return (
                                    <div key={c.nome}>
                                        <div className="flex justify-between gap-2 text-sm">
                                            <span className="text-foreground/85 truncate">{c.nome}</span>
                                            <span className="font-bold text-white whitespace-nowrap">{v(c.valor)}</span>
                                        </div>
                                        <div className="h-1.5 bg-surface rounded-full overflow-hidden mt-1.5">
                                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(pct * 100))}%`, backgroundColor: cor }} />
                                        </div>
                                        {comLimite && <p className="text-[11px] mt-0.5 text-foreground/50" style={{ color: pct >= 0.8 ? cor : undefined }}>{Math.round(pct * 100)}% do limite de {v(c.limite)}</p>}
                                    </div>
                                );
                            })}
                            {categorias.length > 5 && (
                                <button onClick={() => setTodasCategorias(!todasCategorias)} className="text-xs font-bold text-brand-green">
                                    {todasCategorias ? "Mostrar menos" : `Ver todas (${categorias.length})`}
                                </button>
                            )}
                        </div>
                    )}
                </section>

                {/* Caixinhas */}
                <section className={`${card} lg:col-start-3 lg:row-start-2`}>
                    <div className="flex items-center justify-between">
                        <h3 className="font-heading font-bold text-white">Caixinhas</h3>
                        <Link href="/caixinhas" className="text-xs font-bold text-brand-green flex items-center">Abrir <ChevronRight className="w-3.5 h-3.5" /></Link>
                    </div>
                    <p className="text-2xl font-bold text-white mt-2">{v(totalCaixinhas)}</p>
                    {emergencia && (
                        <div className="mt-3">
                            <div className="flex justify-between text-xs">
                                <span className="text-foreground/70 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-brand-blue" />Reserva cobre</span>
                                <b className={mesesCobre !== null && mesesCobre < 3 ? "text-brand-yellow" : "text-white"}>
                                    {mesesCobre === null ? "—" : `${mesesCobre.toFixed(1).replace('.', ',')} ${mesesCobre >= 1 && mesesCobre < 2 ? "mês" : "meses"}`}
                                </b>
                            </div>
                            <div className="h-1.5 bg-surface rounded-full overflow-hidden mt-1.5">
                                <div className="h-full rounded-full bg-brand-blue" style={{ width: `${mesesCobre === null ? 0 : Math.min(100, Math.round(mesesCobre / 6 * 100))}%` }} />
                            </div>
                        </div>
                    )}
                    {outrasCaixinhas.length > 0 && (
                        <div className="mt-3 space-y-1">
                            {outrasCaixinhas.map(c => (
                                <div key={c.id} className="flex justify-between text-xs">
                                    <span className="text-foreground/70 truncate">{c.nome}</span>
                                    <span className="text-white">{v(saldoCaixinha(c, caixinhas!.movimentos, caixinhas!.gastos))}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Ritmo de gastos */}
                <section className={`${card} lg:col-span-2 lg:col-start-1 lg:row-start-4`}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-heading font-bold text-white">Ritmo de gastos</h3>
                        <span className="text-xs text-foreground/50">acumulado no mês</span>
                    </div>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ritmoData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#232b3e" />
                                <XAxis dataKey="dia" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} interval={4} />
                                <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} width={40} tickFormatter={(x) => showValues ? `${(x / 1000).toFixed(1).replace('.', ',')}k` : ''} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f131a', borderColor: '#232b3e', borderRadius: '12px', color: '#fff' }}
                                    labelStyle={{ color: '#f8fafc', fontWeight: 700, marginBottom: 2 }}
                                    separator=": "
                                    labelFormatter={(d) => `Dia ${d}`}
                                    formatter={(x: any, n: any) => [showValues ? formatCurrency(Number(x)) : '••••••', n === 'atual' ? nomeMes(activeMonth) : nomeMes(prevMonth)]}
                                />
                                {liquido > 0 && <ReferenceLine y={liquido} stroke="#ffc94d" strokeDasharray="4 4" label={{ value: 'líquido p/ gastos', position: 'insideTopRight', fill: '#ffc94d', fontSize: 11 }} />}
                                <Line type="stepAfter" dataKey="anterior" stroke="#64748b" strokeWidth={1.5} dot={false} connectNulls={false} />
                                <Line type="stepAfter" dataKey="atual" stroke="#ff4d4d" strokeWidth={2.5} dot={false} connectNulls={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex gap-5 mt-2 text-xs text-foreground/60">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-brand-red inline-block" />{nomeMes(activeMonth)}</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-[#64748b] inline-block" />{nomeMes(prevMonth)}</span>
                    </div>
                </section>

                {/* Últimos lançamentos */}
                <section className={`${card} lg:col-span-2 lg:col-start-1 lg:row-start-5`}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-heading font-bold text-white">Últimos lançamentos</h3>
                        <Link href="/lancamentos" className="text-xs font-bold text-brand-green flex items-center">Ver todos <ChevronRight className="w-3.5 h-3.5" /></Link>
                    </div>
                    {ultimos.length === 0 ? <p className="text-sm text-foreground/50">Nada lançado ainda.</p> : (
                        <div className="divide-y divide-borders">
                            {ultimos.map(t => {
                                const renda = t.tipo === 'renda';
                                const reserva = !renda && isEmergenciaNome(t.categorias?.nome);
                                return (
                                    <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                                        <div className="min-w-0">
                                            <p className="text-sm text-white truncate">{t.descricao}</p>
                                            <p className="text-xs text-foreground/50">{t.data?.slice(8, 10)}/{t.data?.slice(5, 7)} · {renda ? "Receita" : reserva ? "Reserva de emergência" : (t.categorias?.nome || "Sem categoria")}{t.status === 'pendente' ? " · pendente" : ""}</p>
                                        </div>
                                        <span className={`text-sm font-bold whitespace-nowrap ${renda ? "text-brand-green" : reserva ? "text-brand-blue" : "text-brand-red"}`}>
                                            {renda ? "+" : "−"}{v(t.valor)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Sobra por mês */}
                <section className={`${card} lg:col-start-3 lg:row-start-5 flex flex-col`}>
                    <h3 className="font-heading font-bold text-white mb-3">Sobra por mês</h3>
                    <div className="h-[190px] lg:h-auto lg:flex-1 lg:min-h-[190px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sobraPorMes} margin={{ top: 22, right: 0, left: 0, bottom: 0 }}>
                                <XAxis dataKey="rotulo" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
                                <YAxis hide />
                                <ReferenceLine y={0} stroke="#232b3e" />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                                    contentStyle={{ backgroundColor: '#0f131a', borderColor: '#232b3e', borderRadius: '12px', color: '#fff' }}
                                    labelStyle={{ color: '#f8fafc', fontWeight: 700, marginBottom: 2 }}
                                    itemStyle={{ color: '#f8fafc' }}
                                    separator=": "
                                    labelFormatter={(_l, p: any) => p?.[0]?.payload ? formatMonth(p[0].payload.mes) : ''}
                                    formatter={(x: any) => [showValues ? formatCurrency(Number(x)) : '••••••', 'Sobra']}
                                />
                                <Bar dataKey="sobra" radius={[4, 4, 0, 0]} minPointSize={3}>
                                    {sobraPorMes.map(s => <Cell key={s.mes} fill={s.sobra < 0 ? "#ff4d4d" : s.mes === activeMonth ? "#ffc94d" : "#00e5a0"} />)}
                                    {showValues && (
                                        <LabelList dataKey="sobra" position="top" fontSize={10} fill="#94a3b8"
                                            formatter={(x: any) => { const n = Number(x); return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : `${Math.round(n)}`; }} />
                                    )}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-[11px] text-foreground/50 mt-2">Renda − guardado − despesas. Em amarelo, o mês que você está vendo; em vermelho, mês que fechou no negativo.</p>
                </section>
            </div>

            <TransactionModal
                isOpen={modal !== null}
                tipoInicial={modal || undefined}
                onClose={() => setModal(null)}
                onSuccess={fetchData}
            />
        </div>
    );
}

function Mini({ label, valor, cor = "text-white" }: { label: string; valor: string; cor?: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] uppercase font-bold tracking-wider text-foreground/50">{label}</p>
            <p className={`text-sm sm:text-base font-bold truncate ${cor}`}>{valor}</p>
        </div>
    );
}

function Acao({ label, icone, onClick, href }: { label: string; icone: React.ReactNode; onClick?: () => void; href?: string }) {
    const conteudo = (
        <>
            <span className="w-11 h-11 rounded-xl bg-surface border border-borders flex items-center justify-center text-brand-green group-hover:border-brand-green transition-colors">{icone}</span>
            <span className="text-xs text-foreground/70 group-hover:text-white">{label}</span>
        </>
    );
    const cls = "group flex flex-col items-center gap-1.5 py-1";
    return href ? <Link href={href} className={cls}>{conteudo}</Link> : <button onClick={onClick} className={cls}>{conteudo}</button>;
}
