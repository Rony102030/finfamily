"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Check, Copy, Edit2, Plus, Trash2, X, AlertTriangle, Lock } from "lucide-react";
import {
    FrangoData, Fechamento, resumoFechamento, fiadosDoFechamento, replayEstoque, limitesDoMes,
    hoje, dataCurta, diaSemana, formatBRL,
} from "../calc";
import { clientePorNome } from "../data";
import { Card, CampoNumero, inputCls, labelCls, btnPrimario, btnSecundario, n, inteiro, Vazio } from "../ui";

interface LinhaFiado { key: string; cliente: string; qtd: string; tamanho: 'grande' | 'padrao'; travado?: boolean; valorTravado?: number }

const novaLinha = (): LinhaFiado => ({ key: Math.random().toString(36).slice(2), cliente: "", qtd: "1", tamanho: 'padrao' });

export function FechamentoTab({ d, mes, userId, recarregar }: { d: FrangoData; mes: string; userId: string; recarregar: () => Promise<void> }) {
    const [editando, setEditando] = useState<Fechamento | null>(null);
    const [data, setData] = useState(hoje());
    const [farofa, setFarofa] = useState(false);
    const [assados, setAssados] = useState("");
    const [vendGrande, setVendGrande] = useState("");
    const [vendPadrao, setVendPadrao] = useState("");
    const [dinheiro, setDinheiro] = useState("");
    const [pix, setPix] = useState("");
    const [cartao, setCartao] = useState("");
    const [observacao, setObservacao] = useState("");
    const [fiados, setFiados] = useState<LinhaFiado[]>([]);
    const [salvando, setSalvando] = useState(false);

    const precoGrande = editando?.preco_grande ?? d.config.preco_grande;
    const precoPadrao = editando?.preco_padrao ?? d.config.preco_padrao;

    const existente = d.fechamentos.find(f => f.data === data && f.id !== editando?.id);

    const limpar = () => {
        setEditando(null); setData(hoje()); setFarofa(false); setAssados(""); setVendGrande(""); setVendPadrao("");
        setDinheiro(""); setPix(""); setCartao(""); setObservacao(""); setFiados([]);
    };

    const carregar = (f: Fechamento) => {
        setEditando(f); setData(f.data); setFarofa(f.farofa);
        setAssados(String(f.assados)); setVendGrande(String(f.vend_grande || "")); setVendPadrao(String(f.vend_padrao || ""));
        setDinheiro(f.rec_dinheiro ? String(f.rec_dinheiro) : ""); setPix(f.rec_pix ? String(f.rec_pix) : ""); setCartao(f.rec_cartao ? String(f.rec_cartao) : "");
        setObservacao(f.observacao || "");
        setFiados(fiadosDoFechamento(d, f.id).map(x => ({
            key: x.id,
            cliente: d.clientes.find(c => c.id === x.cliente_id)?.nome || "",
            qtd: String(x.qtd),
            tamanho: x.preco_un === f.preco_grande ? 'grande' : 'padrao',
            travado: x.status !== 'aberto' || d.recebimentos.some(r => r.fiado_id === x.id),
            valorTravado: x.valor,
        })));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // último fechamento no mesmo dia da semana, antes desta data
    const anterior = useMemo(() => d.fechamentos
        .filter(f => f.data < data && diaSemana(f.data) === diaSemana(data))
        .sort((a, b) => b.data.localeCompare(a.data))[0], [d.fechamentos, data]);

    const copiarAnterior = () => {
        if (!anterior) return;
        setAssados(String(anterior.assados)); setVendGrande(String(anterior.vend_grande || "")); setVendPadrao(String(anterior.vend_padrao || ""));
        setFarofa(anterior.farofa);
    };

    // números do formulário
    const fiadoLinhas = fiados.filter(f => f.cliente.trim() && inteiro(f.qtd) > 0);
    const valorLinha = (f: LinhaFiado) => f.travado && f.valorTravado !== undefined ? f.valorTravado : inteiro(f.qtd) * (f.tamanho === 'grande' ? precoGrande : precoPadrao);
    const fiadoQtd = fiadoLinhas.reduce((s, f) => s + inteiro(f.qtd), 0);
    const fiadoValor = fiadoLinhas.reduce((s, f) => s + valorLinha(f), 0);
    const vendidos = inteiro(vendGrande) + inteiro(vendPadrao) + fiadoQtd;
    const sobra = inteiro(assados) - vendidos;
    const totalVendido = inteiro(vendGrande) * precoGrande + inteiro(vendPadrao) * precoPadrao + fiadoValor;
    const recebido = n(dinheiro) + n(pix) + n(cartao);
    const diferenca = Math.round((recebido + fiadoValor - totalVendido) * 100) / 100;

    const disponivel = useMemo(() => {
        const semEste = { ...d, fechamentos: d.fechamentos.filter(f => f.id !== editando?.id) };
        return replayEstoque(semEste, data).unidades;
    }, [d, data, editando]);

    const salvar = async () => {
        if (existente) return alert(`Já existe um fechamento em ${dataCurta(data)}. Edite o que já existe.`);
        if (inteiro(assados) <= 0) return alert("Informe quantos frangos foram assados.");
        if (sobra < 0) return alert(`Vendidos (${vendidos}) é maior que assados (${inteiro(assados)}). Confira os números.`);
        if (diferenca !== 0 && !confirm(`O dinheiro não bate com o vendido (diferença de ${formatBRL(diferenca)}). Salvar assim mesmo?`)) return;

        setSalvando(true);
        try {
            const campos = {
                data, farofa, assados: inteiro(assados), vend_grande: inteiro(vendGrande), vend_padrao: inteiro(vendPadrao),
                preco_grande: precoGrande, preco_padrao: precoPadrao,
                rec_dinheiro: n(dinheiro), rec_pix: n(pix), rec_cartao: n(cartao), observacao: observacao.trim() || null,
            };
            let fechamentoId = editando?.id;
            if (editando) {
                const { error } = await supabase.from('frango_fechamentos').update(campos).eq('id', editando.id);
                if (error) throw error;
                const travados = fiados.filter(f => f.travado).map(f => f.key);
                let del = supabase.from('frango_fiados').delete().eq('fechamento_id', editando.id);
                if (travados.length) del = del.not('id', 'in', `(${travados.join(',')})`);
                const { error: e2 } = await del;
                if (e2) throw e2;
                if (travados.length) {
                    const { error: e3 } = await supabase.from('frango_fiados').update({ data }).in('id', travados);
                    if (e3) throw e3;
                }
            } else {
                const { data: novo, error } = await supabase.from('frango_fechamentos').insert({ user_id: userId, ...campos }).select('id').single();
                if (error) throw error;
                fechamentoId = novo.id;
            }

            const clientes = [...d.clientes];
            const linhas = [];
            for (const f of fiadoLinhas.filter(f => !f.travado)) {
                const clienteId = await clientePorNome(userId, f.cliente, clientes);
                if (!clientes.some(c => c.id === clienteId)) clientes.push({ id: clienteId, nome: f.cliente.trim(), telefone: null });
                const preco = f.tamanho === 'grande' ? precoGrande : precoPadrao;
                linhas.push({ user_id: userId, cliente_id: clienteId, fechamento_id: fechamentoId, data, qtd: inteiro(f.qtd), preco_un: preco, valor: inteiro(f.qtd) * preco });
            }
            if (linhas.length) {
                const { error } = await supabase.from('frango_fiados').insert(linhas);
                if (error) throw error;
            }
            await recarregar();
            limpar();
        } catch (e: any) {
            alert("Erro ao salvar: " + (e?.message || e));
        } finally {
            setSalvando(false);
        }
    };

    const excluir = async (f: Fechamento) => {
        const comRecebimento = fiadosDoFechamento(d, f.id).some(x => d.recebimentos.some(r => r.fiado_id === x.id));
        const aviso = comRecebimento ? "\n\nAtenção: os fiados deste dia e os pagamentos já recebidos deles também serão apagados." : "";
        if (!confirm(`Excluir o fechamento de ${dataCurta(f.data)}?${aviso}`)) return;
        const { error } = await supabase.from('frango_fechamentos').delete().eq('id', f.id);
        if (error) return alert("Erro ao excluir: " + error.message);
        if (editando?.id === f.id) limpar();
        await recarregar();
    };

    const { de, ate } = limitesDoMes(mes);
    const doMes = d.fechamentos.filter(f => f.data >= de && f.data <= ate).sort((a, b) => b.data.localeCompare(a.data));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
                <Card
                    titulo={editando ? `Editando ${diaSemana(editando.data)} ${dataCurta(editando.data)}` : "Fechamento do dia"}
                    extra={editando
                        ? <button onClick={limpar} className="p-1 text-foreground/50 hover:text-white"><X className="w-5 h-5" /></button>
                        : anterior && <button onClick={copiarAnterior} className={btnSecundario}><Copy className="w-4 h-4 inline mr-1" />Copiar do último {diaSemana(data)}</button>}
                >
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Data</label>
                            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Farofa hoje?</label>
                            <div className="p-1 bg-surface rounded-xl flex gap-1 border border-borders">
                                {[true, false].map(v => (
                                    <button key={String(v)} type="button" onClick={() => setFarofa(v)}
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${farofa === v ? 'bg-brand-yellow/20 text-brand-yellow' : 'text-foreground/50 hover:text-white'}`}>
                                        {v ? "Sim" : "Não"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    {existente && (
                        <p className="mt-3 text-sm text-brand-yellow">
                            Já tem fechamento em {dataCurta(data)}. <button className="underline" onClick={() => carregar(existente)}>Editar esse</button>
                        </p>
                    )}

                    <h4 className="mt-5 mb-2 text-xs uppercase font-bold tracking-wider text-foreground/50">Frangos</h4>
                    <div className="grid grid-cols-3 gap-3">
                        <CampoNumero label="Assados" value={assados} onChange={setAssados} grande
                            dica={inteiro(assados) > disponivel ? <span className="text-brand-yellow">Estoque tinha {disponivel}</span> : `estoque: ${disponivel}`} />
                        <CampoNumero label={`Vendidos a ${formatBRL(precoGrande)}`} value={vendGrande} onChange={setVendGrande} grande />
                        <CampoNumero label={`Vendidos a ${formatBRL(precoPadrao)}`} value={vendPadrao} onChange={setVendPadrao} grande />
                    </div>

                    <h4 className="mt-5 mb-2 text-xs uppercase font-bold tracking-wider text-foreground/50">Fiado</h4>
                    <datalist id="clientes-frango">{d.clientes.map(c => <option key={c.id} value={c.nome} />)}</datalist>
                    <div className="space-y-2">
                        {fiados.map((f, i) => (
                            <div key={f.key} className="flex gap-2 items-center">
                                {f.travado ? (
                                    <p className="flex-1 text-sm text-foreground/70 flex items-center gap-2 py-2">
                                        <Lock className="w-3.5 h-3.5" /> {f.cliente} · {f.qtd} × {formatBRL(valorLinha(f) / Math.max(1, inteiro(f.qtd)))} <span className="text-xs text-foreground/40">(já teve pagamento)</span>
                                    </p>
                                ) : (
                                    <>
                                        <input list="clientes-frango" placeholder="Nome" value={f.cliente}
                                            onChange={e => setFiados(fiados.map((x, j) => j === i ? { ...x, cliente: e.target.value } : x))}
                                            className={`${inputCls.replace('w-full ', '')} flex-1 min-w-0`} />
                                        <input type="number" min="1" value={f.qtd}
                                            onChange={e => setFiados(fiados.map((x, j) => j === i ? { ...x, qtd: e.target.value } : x))}
                                            className={`${inputCls.replace('w-full ', '')} w-14 flex-none text-center`} />
                                        <select value={f.tamanho}
                                            onChange={e => setFiados(fiados.map((x, j) => j === i ? { ...x, tamanho: e.target.value as any } : x))}
                                            className={`${inputCls.replace('w-full ', '')} w-24 flex-none`}>
                                            <option value="grande">{formatBRL(precoGrande)}</option>
                                            <option value="padrao">{formatBRL(precoPadrao)}</option>
                                        </select>
                                        <button onClick={() => setFiados(fiados.filter((_, j) => j !== i))} className="p-2 text-foreground/40 hover:text-brand-red"><X className="w-4 h-4" /></button>
                                    </>
                                )}
                            </div>
                        ))}
                        <button onClick={() => setFiados([...fiados, novaLinha()])} className={btnSecundario}><Plus className="w-4 h-4 inline mr-1" />Adicionar fiado</button>
                    </div>

                    <h4 className="mt-5 mb-2 text-xs uppercase font-bold tracking-wider text-foreground/50">Recebido</h4>
                    <div className="grid grid-cols-3 gap-3">
                        <CampoNumero label="Dinheiro" prefixo="R$" step="0.01" value={dinheiro} onChange={setDinheiro} />
                        <CampoNumero label="Pix" prefixo="R$" step="0.01" value={pix} onChange={setPix} />
                        <CampoNumero label="Cartão" prefixo="R$" step="0.01" value={cartao} onChange={setCartao} />
                    </div>

                    <div className="mt-4">
                        <label className={labelCls}>Observação (opcional)</label>
                        <input value={observacao} onChange={e => setObservacao(e.target.value)} className={inputCls} placeholder="Ex: choveu, feriado..." />
                    </div>
                </Card>
            </div>

            <div className="lg:col-span-2">
                <div className="lg:sticky lg:top-24 space-y-4">
                    <Card titulo="Conferência">
                        <dl className="text-sm space-y-2">
                            <Item label="Vendidos" valor={`${vendidos} frangos`} />
                            <Item label="Sobrou (casa)" valor={`${sobra} frangos`} cor={sobra < 0 ? "text-brand-red" : "text-white"} />
                            <div className="border-t border-borders pt-2" />
                            <Item label="Total vendido" valor={formatBRL(totalVendido)} />
                            <Item label="Recebido" valor={formatBRL(recebido)} />
                            <Item label="Fiado" valor={formatBRL(fiadoValor)} />
                        </dl>
                        <div className={`mt-4 rounded-xl p-3 text-sm font-bold flex items-center gap-2 ${totalVendido === 0 && recebido === 0 ? "bg-surface text-foreground/50"
                            : diferenca === 0 ? "bg-brand-green/10 text-brand-green" : "bg-brand-red/10 text-brand-red"}`}>
                            {diferenca === 0 ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            {totalVendido === 0 && recebido === 0 ? "Preencha os números"
                                : diferenca === 0 ? "Bate certinho"
                                    : diferenca > 0 ? `Sobrando ${formatBRL(diferenca)} no dinheiro` : `Faltando ${formatBRL(-diferenca)} no dinheiro`}
                        </div>
                        {sobra < 0 && <p className="mt-2 text-xs text-brand-red">Vendidos maior que assados.</p>}
                        <button onClick={salvar} disabled={salvando || !!existente} className={`${btnPrimario} w-full mt-4`}>
                            {salvando ? "Salvando..." : <><Check className="w-5 h-5" /> {editando ? "Salvar alterações" : "Fechar dia"}</>}
                        </button>
                    </Card>
                </div>
            </div>

            <div className="lg:col-span-5">
                <Card titulo="Dias de venda do mês">
                    {doMes.length === 0 ? <Vazio>Nenhum fechamento neste mês.</Vazio> : (
                        <div className="space-y-2">
                            {doMes.map(f => {
                                const r = resumoFechamento(f, fiadosDoFechamento(d, f.id));
                                return (
                                    <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-borders rounded-xl px-4 py-3">
                                        <div>
                                            <p className="text-white font-bold">{diaSemana(f.data)} {dataCurta(f.data)} {f.farofa && <span className="ml-1 text-xs font-medium text-brand-yellow">farofa</span>}</p>
                                            <p className="text-xs text-foreground/60">
                                                {f.assados} assados · {r.vendidos} vendidos · {r.sobra} casa{r.fiadoValor > 0 ? ` · fiado ${formatBRL(r.fiadoValor)}` : ""}
                                                {r.diferenca !== 0 && <span className="text-brand-red"> · diferença {formatBRL(r.diferenca)}</span>}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-brand-green">{formatBRL(r.totalVendido)}</span>
                                            <button onClick={() => carregar(f)} className="p-2 text-foreground/40 hover:text-brand-blue" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => excluir(f)} className="p-2 text-foreground/40 hover:text-brand-red" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

function Item({ label, valor, cor = "text-white" }: { label: string; valor: string; cor?: string }) {
    return (
        <div className="flex justify-between gap-3">
            <dt className="text-foreground/70">{label}</dt>
            <dd className={`font-bold ${cor}`}>{valor}</dd>
        </div>
    );
}
