"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle, Plus } from "lucide-react";
import {
    FrangoData, replayEstoque, resultadoPeriodo, limitesDoMes, lucroPorSemana, fiadosAbertos,
    contribuicaoPorFrango, fixosDoMes, margemPorTipoDeCaixa, efeitoFarofa, mediaAssadosSemana, hoje, formatBRL,
} from "../calc";
import { Card, Numero, btnPrimario } from "../ui";
import type { Aba } from "../page";

export function ResumoTab({ d, mes, irPara }: { d: FrangoData; mes: string; irPara: (a: Aba) => void }) {
    const hojeStr = hoje();
    const { de, ate } = limitesDoMes(mes);
    const ref = ate < hojeStr ? ate : hojeStr; // mês passado: fim do mês; mês atual: hoje

    const calc = useMemo(() => {
        const estoque = replayEstoque(d);
        const r = resultadoPeriodo(d, de, ate, estoque);
        const abertos = fiadosAbertos(d);
        const atrasados = abertos.filter(f => f.dias > 30);
        const contrib = contribuicaoPorFrango(d, ref, 60, estoque);
        const fixos = fixosDoMes(d, mes);
        const semanas = lucroPorSemana(d, ref, 8, estoque);
        const semanasComVenda = semanas.filter(s => s.vendidos > 0);
        const vendidosPorSemana = semanasComVenda.length ? semanasComVenda.reduce((s, x) => s + x.vendidos, 0) / semanasComVenda.length : 0;
        return {
            estoque, r, abertos, atrasados, contrib, fixos, semanas, vendidosPorSemana,
            tabela: margemPorTipoDeCaixa(d, ref, 60, estoque),
            farofa: efeitoFarofa(d),
            mediaAssados: mediaAssadosSemana(d),
        };
    }, [d, de, ate, mes, ref]);

    const { r, estoque } = calc;
    const meta = d.config.meta_mensal;
    const faltamMeta = Math.max(0, meta - r.vendidos);
    const pontoEquilibrio = calc.contrib && calc.contrib > 0 ? Math.ceil(calc.fixos / calc.contrib) : null;
    const clientesAtrasados = new Set(calc.atrasados.map(f => f.cliente_id)).size;
    const valorAtrasado = calc.atrasados.reduce((s, f) => s + f.aberto, 0);
    const valorAberto = calc.abertos.reduce((s, f) => s + f.aberto, 0);
    const estoqueBaixo = calc.mediaAssados > 0 && estoque.unidades < calc.mediaAssados;
    const fechamentosNoPeriodo = calc.tabela.reduce((s, t) => s + t.fechamentos, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-foreground/60">
                    {r.fechamentos} {r.fechamentos === 1 ? "dia de venda" : "dias de venda"} no mês · {r.vendidos} frangos vendidos
                </p>
                <button onClick={() => irPara('fechamento')} className={btnPrimario}>
                    <Plus className="w-5 h-5" /> Fechar dia
                </button>
            </div>

            {estoqueBaixo && (
                <div className="flex items-start gap-3 bg-brand-yellow/10 border border-brand-yellow/40 rounded-2xl p-4 text-sm">
                    <AlertTriangle className="w-5 h-5 text-brand-yellow flex-shrink-0 mt-0.5" />
                    <p className="text-foreground/90">
                        <b className="text-white">Estoque baixo:</b> {estoque.unidades} frangos no freezer e você assa em média {calc.mediaAssados} por semana. Compre até quinta.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Numero
                    label="Lucro do mês" destaque
                    valor={formatBRL(r.lucro)}
                    cor={r.lucro >= 0 ? "text-brand-green" : "text-brand-red"}
                    sub={`Vendas ${formatBRL(r.receita)}`}
                />
                <Numero
                    label="Margem por frango"
                    valor={r.margemPorFrango === null ? "—" : formatBRL(r.margemPorFrango)}
                    cor={r.margemPorFrango !== null && r.margemPorFrango < 0 ? "text-brand-red" : "text-white"}
                    sub="o que sobra por frango vendido, depois de tudo"
                />
                <Numero
                    label="Fiado atrasado"
                    valor={formatBRL(valorAtrasado)}
                    cor={valorAtrasado > 0 ? "text-brand-red" : "text-white"}
                    sub={clientesAtrasados > 0
                        ? `${clientesAtrasados} ${clientesAtrasados === 1 ? "pessoa" : "pessoas"} há +30 dias · ${formatBRL(valorAberto)} em aberto`
                        : `${formatBRL(valorAberto)} em aberto`}
                />
                <Numero
                    label="Meta do mês"
                    valor={<>{r.vendidos} <span className="text-base text-foreground/50">/ {meta}</span></>}
                    cor={faltamMeta === 0 ? "text-brand-green" : "text-white"}
                    sub={faltamMeta === 0 ? "meta batida" : `faltam ${faltamMeta}${calc.vendidosPorSemana > 0 ? ` (≈${(faltamMeta / calc.vendidosPorSemana).toFixed(1).replace('.', ',')} fim de sem.)` : ""}`}
                />
            </div>

            <Card titulo="Lucro por semana" extra={<span className="text-xs text-foreground/50">últimas 8 semanas · antes dos custos fixos</span>}>
                <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={calc.semanas} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#232b3e" />
                            <XAxis dataKey="semana" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
                            <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} width={48} tickFormatter={v => `${Math.round(v)}`} />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                                contentStyle={{ backgroundColor: '#0f131a', borderColor: '#232b3e', borderRadius: '12px', color: '#fff' }}
                                formatter={(v: any, _n: any, p: any) => [`${formatBRL(Number(v))} · ${p?.payload?.vendidos ?? 0} frangos`, "Lucro"]}
                                labelFormatter={l => `Semana de ${l}`}
                            />
                            <Bar dataKey="lucro" radius={[4, 4, 0, 0]}>
                                {calc.semanas.map((s, i) => <Cell key={i} fill={s.lucro >= 0 ? "#00e5a0" : "#ff4d4d"} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card titulo="Como o lucro foi formado">
                    <dl className="text-sm space-y-2">
                        <Linha label="Vendas (inclui fiado do dia)" valor={r.receita} />
                        <Linha label={`Frango assado (${r.assados} un)`} valor={-r.custoFrango} />
                        <Linha label="Outros custos" valor={-r.outrosCustos} />
                        <Linha label="Custos fixos" valor={-r.custosFixos} />
                        {r.perdidos > 0 && <Linha label="Fiado perdido" valor={-r.perdidos} />}
                        <div className="border-t border-borders pt-2">
                            <Linha label="Lucro" valor={r.lucro} forte />
                        </div>
                    </dl>
                    <p className="text-xs text-foreground/50 mt-3">
                        Consumo da casa: {r.sobra} frangos ({formatBRL(r.consumoCasa)}), já incluído no custo do frango.
                    </p>
                </Card>

                <Card titulo="Dinheiro do mês">
                    <dl className="text-sm space-y-2">
                        <Linha label="Dinheiro (em mãos)" valor={r.caixa.dinheiro} neutro />
                        <Linha label="Pix" valor={r.caixa.pix} neutro />
                        <Linha label="Cartão" valor={r.caixa.cartao} neutro />
                        <div className="border-t border-borders pt-2 space-y-2">
                            <Linha label="Entrou" valor={r.caixa.entrou} />
                            <Linha label="Saiu (compras e custos)" valor={-r.caixa.saiu} />
                        </div>
                    </dl>
                    <div className="mt-4 pt-3 border-t border-borders text-sm text-foreground/80 space-y-1">
                        <p>
                            <b className="text-white">Ponto de equilíbrio:</b>{" "}
                            {pontoEquilibrio === null
                                ? "precisa de alguns dias de venda para calcular."
                                : <>precisa vender <b className="text-white">{pontoEquilibrio}</b> frangos para cobrir {formatBRL(calc.fixos)} de fixos; já vendeu {r.vendidos}.</>}
                        </p>
                        {(calc.farofa.com !== null && calc.farofa.sem !== null) && (
                            <p><b className="text-white">Farofa:</b> média de {calc.farofa.com} frangos com farofa e {calc.farofa.sem} sem.</p>
                        )}
                    </div>
                </Card>
            </div>

            <Card titulo="Qual caixa compensa" extra={<span className="text-xs text-foreground/50">últimos 60 dias</span>}>
                {fechamentosNoPeriodo < 4 ? (
                    <p className="text-sm text-foreground/60">
                        Aparece depois de 4 dias de venda com compras registradas ({fechamentosNoPeriodo} até agora). Ela cruza quantos frangos vieram na caixa,
                        quantos você vendeu a {formatBRL(d.config.preco_grande)} e quanto sobrou, e mostra quanto cada tipo de caixa deixa de lucro.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-foreground/50 border-b border-borders">
                                    <th className="py-2 pr-3">Caixa</th>
                                    <th className="py-2 pr-3">Custo/frango</th>
                                    <th className="py-2 pr-3">Vendido a {formatBRL(d.config.preco_grande)}</th>
                                    <th className="py-2 pr-3">Sobrou</th>
                                    <th className="py-2 pr-3 text-right">Margem/caixa</th>
                                </tr>
                            </thead>
                            <tbody>
                                {calc.tabela.map(t => {
                                    const melhor = t.margemCaixa === Math.max(...calc.tabela.map(x => x.margemCaixa));
                                    return (
                                        <tr key={t.frangosNaCaixa} className="border-b border-borders/50">
                                            <td className="py-2 pr-3 text-white font-bold">{t.frangosNaCaixa} frangos <span className="text-xs text-foreground/40 font-normal">({t.fechamentos} dias)</span></td>
                                            <td className="py-2 pr-3">{formatBRL(t.custoUn)}</td>
                                            <td className="py-2 pr-3">{Math.round(t.pctGrande * 100)}%</td>
                                            <td className="py-2 pr-3">{Math.round(t.pctSobra * 100)}%</td>
                                            <td className={`py-2 text-right font-bold ${melhor ? "text-brand-green" : "text-white"}`}>{formatBRL(t.margemCaixa)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <p className="text-xs text-foreground/50 mt-3">
                            Margem por caixa = frangos vendidos × preço médio − custo da caixa − outros custos por frango. Só conta os dias em que a maior parte dos frangos veio do mesmo tipo de caixa.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
}

function Linha({ label, valor, forte = false, neutro = false }: { label: string; valor: number; forte?: boolean; neutro?: boolean }) {
    const cor = neutro ? "text-white" : valor < 0 ? "text-brand-red" : "text-brand-green";
    return (
        <div className="flex items-center justify-between gap-4">
            <dt className={forte ? "text-white font-bold" : "text-foreground/70"}>{label}</dt>
            <dd className={`${cor} ${forte ? "font-bold text-base" : "font-medium"}`}>{formatBRL(valor)}</dd>
        </div>
    );
}
