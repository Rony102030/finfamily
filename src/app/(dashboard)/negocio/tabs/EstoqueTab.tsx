"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2, PackageX } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { FrangoData, replayEstoque, mediaAssadosSemana, dataCurta, formatBRL, hoje, limitesDoMes } from "../calc";
import { Card, Numero, CampoNumero, btnPrimario, inputCls, labelCls, inteiro, Vazio } from "../ui";
import type { Aba } from "../page";

type Props = { d: FrangoData; mes: string; userId: string; recarregar: () => Promise<void>; irPara: (a: Aba) => void };

export function EstoqueTab({ d, mes, userId, recarregar, irPara }: Props) {
    const estoque = useMemo(() => replayEstoque(d), [d]);
    const media = useMemo(() => mediaAssadosSemana(d), [d]);
    const faltou = useMemo(() => Array.from(estoque.consumoPorFechamento.entries())
        .filter(([, c]) => c.faltou > 0)
        .map(([id, c]) => ({ f: d.fechamentos.find(x => x.id === id)!, faltou: c.faltou }))
        .filter(x => x.f), [estoque, d.fechamentos]);

    const cobre = media > 0 ? estoque.unidades / media : null;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Numero label="Frangos no freezer" valor={`${estoque.unidades} un`} sub={`${formatBRL(estoque.valorParado)} parados`} destaque />
                <Numero label="Custo médio" valor={formatBRL(estoque.custoMedio)} sub="por frango, do que está no estoque" />
                <Numero label="Assados por semana" valor={media ? `${media} un` : "—"}
                    sub={cobre === null ? "média das últimas 4 semanas" : cobre >= 1 ? `estoque cobre ${cobre.toFixed(1).replace('.', ',')} semana(s)` : "estoque não cobre a próxima semana"}
                    cor={cobre !== null && cobre < 1 ? "text-brand-yellow" : "text-white"} />
            </div>

            {cobre !== null && cobre < 1 && (
                <div className="secao flex flex-wrap items-center justify-between gap-3 text-sm">
                    <p className="flex items-center gap-2 text-foreground/90"><AlertTriangle className="w-5 h-5 text-brand-yellow" /> Estoque não cobre um fim de semana. Compre até quinta.</p>
                    <button onClick={() => irPara('compras')} className={`${btnPrimario} py-2`}><Plus className="w-4 h-4" /> Registrar compra</button>
                </div>
            )}

            <Card titulo="Lotes no estoque" extra={<span className="text-xs text-foreground/50">sai primeiro o mais antigo</span>}>
                {estoque.lotes.length === 0 ? <Vazio>Estoque vazio. Registre uma compra em Compras.</Vazio> : (
                    <div className="space-y-2">
                        {lotesAgrupados(estoque.lotes).map((l, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 border-b border-borders py-2.5 text-sm">
                                <p className="text-foreground/80"><b className="text-white">{dataCurta(l.data)}</b> · {l.caixas} {l.caixas === 1 ? "caixa" : "caixas"} de {l.frangosNaCaixa} · {formatBRL(l.custoUn)}/un</p>
                                <p className="font-bold text-white">{l.restante} un</p>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <PerdaNoEstoque d={d} mes={mes} userId={userId} recarregar={recarregar} unidades={estoque.unidades} consumo={estoque.consumoPorPerda} />

            {faltou.length > 0 && (
                <Card titulo="Dias em que faltou compra registrada">
                    <p className="text-sm text-foreground/60 mb-3">Nestes dias foram assados mais frangos do que havia no estoque. O custo desses frangos usou o último preço conhecido. Registre a compra que faltou para o cálculo ficar certo.</p>
                    <ul className="text-sm space-y-1">
                        {faltou.map(x => <li key={x.f.id} className="text-foreground/80">{dataCurta(x.f.data)}: faltaram {x.faltou} frangos</li>)}
                    </ul>
                </Card>
            )}
        </div>
    );
}

/** Junta lotes seguidos da mesma compra, com o mesmo tamanho de caixa e custo. */
function lotesAgrupados(lotes: { data: string; compraId: string; frangosNaCaixa: number; custoUn: number; restante: number }[]) {
    const out: { data: string; compraId: string; frangosNaCaixa: number; custoUn: number; restante: number; caixas: number }[] = [];
    for (const l of lotes) {
        const u = out[out.length - 1];
        if (u && u.compraId === l.compraId && u.frangosNaCaixa === l.frangosNaCaixa && u.custoUn === l.custoUn) { u.restante += l.restante; u.caixas++; }
        else out.push({ ...l, caixas: 1 });
    }
    return out;
}

const MOTIVOS = ["Estragou", "Venceu", "Caiu / quebrou", "Veio ruim na caixa", "Outro"];

/** Frango que se perdeu antes de ser assado: sai do estoque (dos lotes mais antigos) e entra como prejuízo no mês. */
function PerdaNoEstoque({ d, mes, userId, recarregar, unidades, consumo }: {
    d: FrangoData; mes: string; userId: string; recarregar: () => Promise<void>; unidades: number;
    consumo: Map<string, { custo: number; qtd: number }>;
}) {
    const [data, setData] = useState(hoje());
    const [qtd, setQtd] = useState("");
    const [motivo, setMotivo] = useState(MOTIVOS[0]);
    const [salvando, setSalvando] = useState(false);

    const { de, ate } = limitesDoMes(mes);
    const doMes = (d.perdas || []).filter(p => p.data >= de && p.data <= ate).sort((a, b) => b.data.localeCompare(a.data));
    const totalMes = doMes.reduce((s, p) => s + (consumo.get(p.id)?.custo || 0), 0);

    if (d.perdasIndisponivel) return (
        <Card titulo="Perda no estoque">
            <p className="text-sm text-foreground/70">Para registrar perdas, rode o arquivo <code className="text-brand-yellow">migration_frango_perdas.sql</code> no Supabase (SQL Editor) e recarregue.</p>
        </Card>
    );

    const registrar = async () => {
        const q = inteiro(qtd);
        if (q <= 0) return alert("Informe quantos frangos se perderam.");
        if (q > unidades && !confirm(`O estoque tem ${unidades} frangos e você informou ${q}. Registrar mesmo assim? Só sai o que existe no estoque.`)) return;
        setSalvando(true);
        const { error } = await supabase.from('frango_perdas').insert({ user_id: userId, data, qtd: q, motivo });
        setSalvando(false);
        if (error) return alert("Erro ao registrar: " + error.message);
        setQtd("");
        await recarregar();
    };

    const excluir = async (id: string) => {
        if (!confirm("Excluir esta perda? Os frangos voltam para o estoque.")) return;
        const { error } = await supabase.from('frango_perdas').delete().eq('id', id);
        if (error) return alert("Erro ao excluir: " + error.message);
        await recarregar();
    };

    return (
        <Card titulo={<span className="flex items-center gap-2"><PackageX className="w-5 h-5 text-brand-red" />Perda no estoque</span>}
            extra={totalMes > 0 && <span className="text-sm font-bold text-brand-red">−{formatBRL(totalMes)} no mês</span>}>
            <p className="text-sm text-foreground/60 mb-4">Frango que estragou, venceu ou se perdeu <b className="text-foreground/80">antes de ser assado</b>. Sai do estoque (dos mais antigos primeiro) e entra como prejuízo no lucro do mês. Frango assado que sobrou já conta no Fechar dia.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div>
                    <label className={labelCls}>Data</label>
                    <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
                </div>
                <CampoNumero label="Frangos perdidos" value={qtd} onChange={setQtd} min="1" placeholder="2" />
                <div className="col-span-2 sm:col-span-1">
                    <label className={labelCls}>Motivo</label>
                    <select value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls}>
                        {MOTIVOS.map(m => <option key={m}>{m}</option>)}
                    </select>
                </div>
                <button onClick={registrar} disabled={salvando || inteiro(qtd) <= 0} className={`${btnPrimario} col-span-2 sm:col-span-1`}>
                    {salvando ? "Salvando..." : <><PackageX className="w-4 h-4" /> Registrar perda</>}
                </button>
            </div>

            {doMes.length > 0 && (
                <div className="mt-5">
                    <p className="text-xs uppercase font-bold tracking-wider text-foreground/50 mb-1">Perdas do mês</p>
                    {doMes.map(p => {
                        const c = consumo.get(p.id);
                        return (
                            <div key={p.id} className="flex items-center justify-between gap-3 border-b border-borders py-2.5 text-sm">
                                <p className="text-foreground/80"><b className="text-white">{dataCurta(p.data)}</b> · {p.qtd} {p.qtd === 1 ? "frango" : "frangos"}{p.motivo ? ` · ${p.motivo}` : ""}
                                    {c && c.qtd < p.qtd && <span className="text-brand-yellow"> (só havia {c.qtd} no estoque)</span>}</p>
                                <span className="flex items-center gap-1">
                                    <b className="text-brand-red whitespace-nowrap">−{formatBRL(c?.custo || 0)}</b>
                                    <button onClick={() => excluir(p.id)} className="p-2 text-foreground/40 hover:text-brand-red" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
