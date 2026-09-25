"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Check, Edit2, Plus, Trash2, X, RotateCcw } from "lucide-react";
import { FrangoData, Compra, Custo, CATEGORIAS_CUSTO, custoMedioHistorico, replayEstoque, limitesDoMes, hoje, dataCurta, formatBRL, agruparCaixas, textoCaixas } from "../calc";
import { Card, CampoNumero, inputCls, labelCls, btnPrimario, btnSecundario, n, inteiro, Vazio } from "../ui";

type Props = { d: FrangoData; mes: string; userId: string; recarregar: () => Promise<void> };

export function ComprasTab(props: Props) {
    return (
        <div className="space-y-6">
            <CompraFrango {...props} />
            <OutrosCustos {...props} />
        </div>
    );
}

function CompraFrango({ d, mes, userId, recarregar }: Props) {
    const [editando, setEditando] = useState<Compra | null>(null);
    const [data, setData] = useState(hoje());
    const [precoKg, setPrecoKg] = useState("");
    const [kgCaixa, setKgCaixa] = useState(String(d.config.kg_por_caixa));
    // cada linha: "X caixas com Y frangos" (ex.: 5 com 8 + 5 com 7)
    const [grupos, setGrupos] = useState<{ qtd: string; frangos: string }[]>([{ qtd: "", frangos: "" }]);
    const [salvando, setSalvando] = useState(false);

    const limpar = () => { setEditando(null); setData(hoje()); setPrecoKg(""); setKgCaixa(String(d.config.kg_por_caixa)); setGrupos([{ qtd: "", frangos: "" }]); };
    const carregar = (c: Compra) => {
        setEditando(c); setData(c.data); setPrecoKg(String(c.preco_kg)); setKgCaixa(String(c.kg_por_caixa));
        setGrupos(agruparCaixas(c.caixas).map(g => ({ qtd: String(g.qtd), frangos: String(g.frangos) })));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const mudarGrupo = (i: number, campo: 'qtd' | 'frangos', v: string) => setGrupos(grupos.map((g, j) => j === i ? { ...g, [campo]: v } : g));

    const preenchidos = grupos.filter(g => g.qtd.trim() || g.frangos.trim());
    const caixas = preenchidos.flatMap(g => Array.from({ length: Math.min(200, inteiro(g.qtd)) }, () => inteiro(g.frangos)));
    const custoCaixa = n(precoKg) * n(kgCaixa);
    const frangos = caixas.reduce((s, c) => s + c, 0);
    const total = custoCaixa * caixas.length;
    const custoUn = frangos > 0 ? total / frangos : 0;
    const media = custoMedioHistorico(d, editando?.id);
    const completo = n(precoKg) > 0 && n(kgCaixa) > 0 && preenchidos.length > 0 && preenchidos.every(g => inteiro(g.qtd) > 0 && inteiro(g.frangos) > 0);

    const salvar = async () => {
        if (!completo) return alert("Preencha o preço do kg e, em cada linha, quantas caixas e quantos frangos vieram em cada uma.");
        setSalvando(true);
        const campos = { data, preco_kg: n(precoKg), kg_por_caixa: n(kgCaixa), caixas };
        const { error } = editando
            ? await supabase.from('frango_compras').update(campos).eq('id', editando.id)
            : await supabase.from('frango_compras').insert({ user_id: userId, ...campos });
        setSalvando(false);
        if (error) return alert("Erro ao salvar: " + error.message);
        await recarregar();
        limpar();
    };

    const excluir = async (c: Compra) => {
        if (!confirm(`Excluir a compra de ${dataCurta(c.data)}? O estoque é recalculado.`)) return;
        const { error } = await supabase.from('frango_compras').delete().eq('id', c.id);
        if (error) return alert("Erro ao excluir: " + error.message);
        if (editando?.id === c.id) limpar();
        await recarregar();
    };

    const { de, ate } = limitesDoMes(mes);
    const doMes = d.compras.filter(c => c.data >= de && c.data <= ate).sort((a, b) => b.data.localeCompare(a.data));
    const estoqueDepois = useMemo(() => replayEstoque(d), [d]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-3" titulo={editando ? `Editando compra de ${dataCurta(editando.data)}` : "Compra de frango"}
                extra={editando && <button onClick={limpar} className="p-1 text-foreground/50 hover:text-white"><X className="w-5 h-5" /></button>}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                        <label className={labelCls}>Data</label>
                        <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
                    </div>
                    <CampoNumero label="Preço do kg" prefixo="R$" step="0.01" value={precoKg} onChange={setPrecoKg} placeholder="8,90" />
                    <CampoNumero label="Kg por caixa" step="0.5" value={kgCaixa} onChange={setKgCaixa} />
                </div>

                <label className={`${labelCls} mt-4`}>Caixas que chegaram (junte as que vieram com a mesma quantidade)</label>
                <div className="space-y-2">
                    {grupos.map((g, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-foreground/70">
                            <input type="number" min="1" inputMode="numeric" value={g.qtd} placeholder="5"
                                onChange={e => mudarGrupo(i, 'qtd', e.target.value)}
                                className={`${inputCls.replace('w-full ', '')} w-20 text-center text-lg font-bold`} />
                            <span className="whitespace-nowrap">{inteiro(g.qtd) === 1 ? "caixa com" : "caixas com"}</span>
                            <input type="number" min="1" inputMode="numeric" value={g.frangos} placeholder="8"
                                onChange={e => mudarGrupo(i, 'frangos', e.target.value)}
                                className={`${inputCls.replace('w-full ', '')} w-20 text-center text-lg font-bold`} />
                            <span className="whitespace-nowrap">frangos</span>
                            {grupos.length > 1 && (
                                <button onClick={() => setGrupos(grupos.filter((_, j) => j !== i))} className="p-2 text-foreground/40 hover:text-brand-red" title="Tirar esta linha"><X className="w-4 h-4" /></button>
                            )}
                        </div>
                    ))}
                    <button onClick={() => setGrupos([...grupos, { qtd: "", frangos: "" }])} className={btnSecundario}>
                        <Plus className="w-4 h-4 inline mr-1" />Caixas com outra quantidade
                    </button>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-foreground/70">
                        {caixas.length * n(kgCaixa)} kg · <b className="text-white">{formatBRL(total)}</b> · {frangos} frangos
                    </p>
                    <button onClick={salvar} disabled={salvando || !completo} className={btnPrimario}>
                        {salvando ? "Salvando..." : <><Check className="w-5 h-5" /> {editando ? "Salvar" : "Registrar compra"}</>}
                    </button>
                </div>
            </Card>

            <Card className="lg:col-span-2" titulo="Esta compra">
                {frangos === 0 ? <p className="text-sm text-foreground/50">Preencha para ver o custo por frango.</p> : (
                    <div className="space-y-3 text-sm">
                        <p className="text-3xl font-bold text-white">{formatBRL(custoUn)}<span className="text-sm text-foreground/50 font-normal"> / frango</span></p>
                        {media !== null && (
                            <p className={custoUn <= media ? "text-brand-green font-bold" : "text-brand-red font-bold"}>
                                {custoUn <= media ? "✓ Compra boa" : "Acima da média"} — sua média é {formatBRL(media)}
                            </p>
                        )}
                        {agruparCaixas(caixas).length > 1 && (
                            <ul className="text-foreground/70 space-y-1">
                                {agruparCaixas(caixas).map((g, i) => g.frangos > 0 && (
                                    <li key={i}>{g.qtd} {g.qtd === 1 ? "caixa" : "caixas"} de {g.frangos}: {formatBRL(custoCaixa / g.frangos)}/frango</li>
                                ))}
                            </ul>
                        )}
                        <p className="text-xs text-foreground/50">Estoque atual: {estoqueDepois.unidades} frangos a {formatBRL(estoqueDepois.custoMedio)} de média.</p>
                    </div>
                )}
            </Card>

            <Card className="lg:col-span-5" titulo="Compras de frango do mês">
                {doMes.length === 0 ? <Vazio>Nenhuma compra neste mês.</Vazio> : (
                    <div className="space-y-2">
                        {doMes.map(c => {
                            const qtd = c.caixas.reduce((s, x) => s + x, 0);
                            const tot = c.preco_kg * c.kg_por_caixa * c.caixas.length;
                            return (
                                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-borders rounded-xl px-4 py-3">
                                    <div>
                                        <p className="text-white font-bold">{dataCurta(c.data)} · {c.caixas.length} {c.caixas.length === 1 ? "caixa" : "caixas"} ({textoCaixas(c.caixas)} · {qtd} frangos)</p>
                                        <p className="text-xs text-foreground/60">{formatBRL(c.preco_kg)}/kg · {formatBRL(tot / qtd)}/frango</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-brand-red">{formatBRL(tot)}</span>
                                        <button onClick={() => carregar(c)} className="p-2 text-foreground/40 hover:text-brand-blue" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => excluir(c)} className="p-2 text-foreground/40 hover:text-brand-red" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
}

function OutrosCustos({ d, mes, userId, recarregar }: Props) {
    const [editando, setEditando] = useState<Custo | null>(null);
    const [data, setData] = useState(hoje());
    const [categoria, setCategoria] = useState("");
    const [valor, setValor] = useState("");
    const [descricao, setDescricao] = useState("");
    const [salvando, setSalvando] = useState(false);

    const limpar = () => { setEditando(null); setData(hoje()); setCategoria(""); setValor(""); setDescricao(""); };
    const carregar = (c: Custo) => { setEditando(c); setData(c.data); setCategoria(c.categoria); setValor(String(c.valor)); setDescricao(c.descricao || ""); };

    // último valor lançado de cada categoria (sem os fixos)
    const ultimos = useMemo(() => {
        const m = new Map<string, Custo>();
        for (const c of [...d.custos].filter(c => !c.fixo_id).sort((a, b) => a.data.localeCompare(b.data))) m.set(c.categoria, c);
        return Array.from(m.values()).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
    }, [d.custos]);

    const categorias = Array.from(new Set([...CATEGORIAS_CUSTO, ...d.custos.filter(c => !c.fixo_id).map(c => c.categoria)]));

    const salvar = async () => {
        if (!categoria.trim() || !(n(valor) > 0)) return alert("Escolha a categoria e o valor.");
        setSalvando(true);
        const campos = { data, categoria: categoria.trim(), valor: n(valor), descricao: descricao.trim() || null };
        const { error } = editando
            ? await supabase.from('frango_custos').update(campos).eq('id', editando.id)
            : await supabase.from('frango_custos').insert({ user_id: userId, ...campos });
        setSalvando(false);
        if (error) return alert("Erro ao salvar: " + error.message);
        await recarregar();
        limpar();
    };

    const excluir = async (c: Custo) => {
        if (c.fixo_id) {
            // fixo excluído voltaria no próximo carregamento: zera o valor do mês
            if (!confirm(`Não teve ${c.categoria} neste mês? O valor fica zerado.`)) return;
            const { error } = await supabase.from('frango_custos').update({ valor: 0 }).eq('id', c.id);
            if (error) return alert("Erro: " + error.message);
        } else {
            if (!confirm(`Excluir ${c.categoria} de ${formatBRL(c.valor)}?`)) return;
            const { error } = await supabase.from('frango_custos').delete().eq('id', c.id);
            if (error) return alert("Erro: " + error.message);
        }
        if (editando?.id === c.id) limpar();
        await recarregar();
    };

    const { de, ate } = limitesDoMes(mes);
    const doMes = d.custos.filter(c => c.data >= de && c.data <= ate).sort((a, b) => b.data.localeCompare(a.data));
    const totalMes = doMes.reduce((s, c) => s + c.valor, 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-2" titulo={editando ? "Editar custo" : "Outros custos"}
                extra={editando && <button onClick={limpar} className="p-1 text-foreground/50 hover:text-white"><X className="w-5 h-5" /></button>}>
                {!editando && ultimos.length > 0 && (
                    <div className="mb-4">
                        <p className={labelCls}>Repetir último (data de hoje)</p>
                        <div className="flex flex-wrap gap-2">
                            {ultimos.map(u => (
                                <button key={u.id} onClick={() => { setCategoria(u.categoria); setValor(String(u.valor)); setDescricao(u.descricao || ""); setData(hoje()); }}
                                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-borders text-foreground/80 hover:border-brand-yellow hover:text-brand-yellow transition-colors">
                                    <RotateCcw className="w-3 h-3 inline mr-1" />{u.categoria} {formatBRL(u.valor)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Data</label>
                            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
                        </div>
                        <CampoNumero label="Valor" prefixo="R$" step="0.01" value={valor} onChange={setValor} />
                    </div>
                    <div>
                        <label className={labelCls}>Categoria</label>
                        <input list="categorias-frango" value={categoria} onChange={e => setCategoria(e.target.value)} className={inputCls} placeholder="Tempero, Embalagem, Gás..." />
                        <datalist id="categorias-frango">{categorias.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                    <div>
                        <label className={labelCls}>Descrição (opcional)</label>
                        <input value={descricao} onChange={e => setDescricao(e.target.value)} className={inputCls} />
                    </div>
                    <button onClick={salvar} disabled={salvando} className={`${btnPrimario} w-full`}>
                        {salvando ? "Salvando..." : <>{editando ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />} {editando ? "Salvar" : "Lançar custo"}</>}
                    </button>
                </div>
            </Card>

            <Card className="lg:col-span-3" titulo="Custos do mês" extra={<span className="text-sm font-bold text-brand-red">{formatBRL(totalMes)}</span>}>
                {doMes.length === 0 ? <Vazio>Nenhum custo neste mês.</Vazio> : (
                    <div className="space-y-2">
                        {doMes.map(c => (
                            <div key={c.id} className="flex items-center justify-between gap-3 bg-surface border border-borders rounded-xl px-4 py-2.5">
                                <div className="min-w-0">
                                    <p className="text-white font-medium truncate">
                                        {c.categoria} {c.fixo_id && <span className="text-[10px] uppercase font-bold text-brand-blue ml-1">fixo</span>}
                                    </p>
                                    <p className="text-xs text-foreground/50 truncate">{dataCurta(c.data)}{c.descricao ? ` · ${c.descricao}` : ""}</p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="font-bold text-brand-red mr-1">{formatBRL(c.valor)}</span>
                                    <button onClick={() => carregar(c)} className="p-2 text-foreground/40 hover:text-brand-blue" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => excluir(c)} className="p-2 text-foreground/40 hover:text-brand-red" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
