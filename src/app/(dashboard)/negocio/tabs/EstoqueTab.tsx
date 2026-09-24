"use client";

import { useMemo } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { FrangoData, replayEstoque, mediaAssadosSemana, dataCurta, formatBRL } from "../calc";
import { Card, Numero, btnPrimario, Vazio } from "../ui";
import type { Aba } from "../page";

export function EstoqueTab({ d, irPara }: { d: FrangoData; irPara: (a: Aba) => void }) {
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
                        {estoque.lotes.map((l, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 bg-surface border border-borders rounded-xl px-4 py-2.5 text-sm">
                                <p className="text-foreground/80"><b className="text-white">{dataCurta(l.data)}</b> · caixa de {l.frangosNaCaixa} · {formatBRL(l.custoUn)}/un</p>
                                <p className="font-bold text-white">{l.restante} un</p>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

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
