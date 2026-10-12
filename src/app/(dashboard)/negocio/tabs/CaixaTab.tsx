"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Check, Trash2, Wallet, UserRound, X } from "lucide-react";
import { FrangoData, MovDono, saldoCaixa, contaComDono, hoje, dataCurta, formatBRL } from "../calc";
import { Card, Numero, CampoNumero, btnPrimario, btnSecundario, inputCls, labelCls, n, Vazio } from "../ui";

type Props = { d: FrangoData; userId: string; recarregar: () => Promise<void> };

export function CaixaTab(props: Props) {
    if (props.d.melhoriasIndisponivel) return (
        <Card titulo="Caixa">
            <p className="text-sm text-foreground/70">Para usar o saldo do caixa e a conta com o dono, rode o arquivo <code className="text-brand-yellow">migration_melhorias_outubro.sql</code> no Supabase (SQL Editor) e recarregue.</p>
        </Card>
    );
    return (
        <div className="space-y-6">
            <SaldoDoCaixa {...props} />
            <ContaComDono {...props} />
        </div>
    );
}

/** Quanto tem em dinheiro e na conta, a partir do último saldo conferido. */
function SaldoDoCaixa({ d, userId, recarregar }: Props) {
    const saldo = useMemo(() => saldoCaixa(d), [d]);
    const [conferindo, setConferindo] = useState(false);
    const [data, setData] = useState(hoje());
    const [dinheiro, setDinheiro] = useState("");
    const [conta, setConta] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [todos, setTodos] = useState(false);

    const abrirConferencia = () => {
        setData(hoje());
        setDinheiro(saldo ? String(saldo.dinheiro) : "");
        setConta(saldo ? String(saldo.conta) : "");
        setConferindo(true);
    };

    const salvar = async () => {
        setSalvando(true);
        const { error } = await supabase.from('frango_config')
            .upsert({ user_id: userId, caixa_data: data, caixa_dinheiro: n(dinheiro), caixa_pix: n(conta) }, { onConflict: 'user_id' });
        setSalvando(false);
        if (error) return alert("Erro ao salvar: " + error.message);
        setConferindo(false);
        await recarregar();
    };

    const form = (
        <div className="space-y-3">
            <p className="text-sm text-foreground/60">Conte o dinheiro e veja o saldo da conta. A partir daí o app soma as vendas e tira as compras e custos pagos do caixa.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div className="col-span-2 sm:col-span-1">
                    <label className={labelCls}>Conferido no fim do dia</label>
                    <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
                </div>
                <CampoNumero label="Dinheiro em mãos" prefixo="R$" step="0.01" value={dinheiro} onChange={setDinheiro} />
                <CampoNumero label="Na conta (Pix)" prefixo="R$" step="0.01" value={conta} onChange={setConta} />
                <button onClick={salvar} disabled={salvando} className={`${btnPrimario} col-span-2 sm:col-span-1`}>
                    {salvando ? "Salvando..." : <><Check className="w-4 h-4" /> Salvar saldo</>}
                </button>
            </div>
        </div>
    );

    if (!saldo) return (
        <Card titulo={<span className="flex items-center gap-2"><Wallet className="w-5 h-5 text-brand-yellow" />Saldo do caixa</span>}>
            {form}
        </Card>
    );

    const lista = todos ? saldo.movimentos : saldo.movimentos.slice(0, 8);
    return (
        <Card titulo={<span className="flex items-center gap-2"><Wallet className="w-5 h-5 text-brand-yellow" />Saldo do caixa</span>}
            extra={conferindo
                ? <button onClick={() => setConferindo(false)} className="p-1 text-foreground/50 hover:text-white"><X className="w-5 h-5" /></button>
                : <button onClick={abrirConferencia} className={btnSecundario}>Conferir saldo</button>}>
            {conferindo ? form : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Numero label="Dinheiro em mãos" valor={formatBRL(saldo.dinheiro)} cor={saldo.dinheiro < 0 ? "text-brand-red" : "text-white"} />
                        <Numero label="Na conta (Pix e cartão)" valor={formatBRL(saldo.conta)} cor={saldo.conta < 0 ? "text-brand-red" : "text-white"} />
                        <Numero label="Total" valor={formatBRL(saldo.total)} cor={saldo.total < 0 ? "text-brand-red" : "text-brand-green"} sub={`desde a conferência de ${dataCurta(saldo.desde)}`} />
                    </div>
                    {(saldo.dinheiro < 0 || saldo.conta < 0) && (
                        <p className="text-xs text-brand-yellow mt-3">Saldo negativo costuma ser um custo marcado com a forma errada ou uma venda não lançada. Confira e, se precisar, ajuste em "Conferir saldo".</p>
                    )}
                    <div className="mt-5">
                        <p className="text-xs uppercase font-bold tracking-wider text-foreground/50 mb-1">Movimentos desde {dataCurta(saldo.desde)}</p>
                        {saldo.movimentos.length === 0 ? <p className="text-sm text-foreground/50 py-2">Nada ainda.</p> : lista.map((m, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 border-b border-borders py-2 text-sm">
                                <p className="text-foreground/80 min-w-0 truncate"><b className="text-white">{dataCurta(m.data)}</b> · {m.descricao}</p>
                                <span className="text-right whitespace-nowrap text-xs">
                                    {m.dinheiro !== 0 && <span className={m.dinheiro > 0 ? "text-brand-green" : "text-brand-red"}>{m.dinheiro > 0 ? "+" : "−"}{formatBRL(Math.abs(m.dinheiro))} dinheiro</span>}
                                    {m.dinheiro !== 0 && m.conta !== 0 && <br />}
                                    {m.conta !== 0 && <span className={m.conta > 0 ? "text-brand-green" : "text-brand-red"}>{m.conta > 0 ? "+" : "−"}{formatBRL(Math.abs(m.conta))} conta</span>}
                                </span>
                            </div>
                        ))}
                        {saldo.movimentos.length > 8 && (
                            <button onClick={() => setTodos(!todos)} className="text-xs font-bold text-brand-yellow mt-2">{todos ? "Mostrar menos" : `Ver todos (${saldo.movimentos.length})`}</button>
                        )}
                    </div>
                </>
            )}
        </Card>
    );
}

const TIPOS: { id: MovDono['tipo']; label: string; ajuda: string }[] = [
    { id: 'pro_labore', label: "Pró-labore", ajuda: "o negócio passa a te dever esse valor" },
    { id: 'retirada', label: "Retirada", ajuda: "você tirou dinheiro do caixa" },
    { id: 'aporte', label: "Aporte", ajuda: "você colocou dinheiro no caixa" },
];

/** O que o negócio deve ao dono (custos pagos do bolso, pró-labore) e o que o dono já tirou. */
function ContaComDono({ d, userId, recarregar }: Props) {
    const conta = useMemo(() => contaComDono(d), [d]);
    const [tipo, setTipo] = useState<MovDono['tipo']>('retirada');
    const [data, setData] = useState(hoje());
    const [valor, setValor] = useState("");
    const [forma, setForma] = useState<'dinheiro' | 'pix'>('dinheiro');
    const [descricao, setDescricao] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [todos, setTodos] = useState(false);

    const registrar = async () => {
        if (!(n(valor) > 0)) return alert("Informe o valor.");
        setSalvando(true);
        const { error } = await supabase.from('frango_conta_dono').insert({
            user_id: userId, data, tipo, valor: n(valor), forma: tipo === 'pro_labore' ? null : forma, descricao: descricao.trim() || null,
        });
        setSalvando(false);
        if (error) return alert("Erro ao registrar: " + error.message);
        setValor(""); setDescricao("");
        await recarregar();
    };

    const excluir = async (id: string) => {
        if (!confirm("Excluir este lançamento da conta com o dono?")) return;
        const { error } = await supabase.from('frango_conta_dono').delete().eq('id', id);
        if (error) return alert("Erro ao excluir: " + error.message);
        await recarregar();
    };

    const lista = todos ? conta.linhas : conta.linhas.slice(0, 8);
    const ajuda = TIPOS.find(t => t.id === tipo)!.ajuda;

    return (
        <Card titulo={<span className="flex items-center gap-2"><UserRound className="w-5 h-5 text-brand-blue" />Conta com o dono</span>}>
            <div className="pb-4 border-b border-borders">
                <p className="text-xs uppercase font-bold tracking-wider text-foreground/50">
                    {conta.saldo >= 0 ? "O negócio deve ao dono" : "O dono tirou a mais"}
                </p>
                <p className={`mt-2 text-3xl font-bold tracking-tight ${conta.saldo > 0 ? "text-brand-yellow" : conta.saldo < 0 ? "text-brand-red" : "text-white"}`}>{formatBRL(Math.abs(conta.saldo))}</p>
                <p className="mt-1 text-xs text-foreground/60">Custos pagos do bolso do dono entram aqui sozinhos (marque "Bolso do dono" ao lançar o custo).</p>
            </div>

            <div className="mt-4 space-y-3">
                <div className="p-1 bg-surface rounded-xl flex gap-1 border border-borders">
                    {TIPOS.map(t => (
                        <button key={t.id} type="button" onClick={() => setTipo(t.id)}
                            className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${tipo === t.id ? 'bg-brand-yellow/20 text-brand-yellow' : 'text-foreground/50 hover:text-white'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-foreground/60">{TIPOS.find(t => t.id === tipo)!.label}: {ajuda}.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                    <div>
                        <label className={labelCls}>Data</label>
                        <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
                    </div>
                    <CampoNumero label="Valor" prefixo="R$" step="0.01" value={valor} onChange={setValor} />
                    {tipo !== 'pro_labore' ? (
                        <div className="col-span-2 sm:col-span-1">
                            <label className={labelCls}>{tipo === 'retirada' ? "Saiu do" : "Entrou no"}</label>
                            <div className="p-1 bg-surface rounded-xl flex gap-1 border border-borders">
                                {(['dinheiro', 'pix'] as const).map(f => (
                                    <button key={f} type="button" onClick={() => setForma(f)}
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${forma === f ? 'bg-brand-yellow/20 text-brand-yellow' : 'text-foreground/50 hover:text-white'}`}>
                                        {f === 'dinheiro' ? "Dinheiro" : "Conta"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : <div className="hidden sm:block" />}
                    <div className="col-span-2 sm:col-span-1">
                        <label className={labelCls}>Descrição (opcional)</label>
                        <input value={descricao} onChange={e => setDescricao(e.target.value)} className={inputCls} placeholder="Ex: setembro" />
                    </div>
                </div>
                <button onClick={registrar} disabled={salvando || !(n(valor) > 0)} className={`${btnPrimario} w-full sm:w-auto`}>
                    {salvando ? "Salvando..." : <><Check className="w-4 h-4" /> Registrar</>}
                </button>
            </div>

            <div className="mt-5">
                {conta.linhas.length === 0 ? <Vazio>Nada na conta com o dono ainda.</Vazio> : (
                    <>
                        {lista.map((l, i) => (
                            <div key={l.id || i} className="flex items-center justify-between gap-3 border-b border-borders py-2 text-sm">
                                <p className="text-foreground/80 min-w-0 truncate"><b className="text-white">{dataCurta(l.data)}</b> · {l.descricao}</p>
                                <span className="flex items-center gap-1">
                                    <b className={`whitespace-nowrap ${l.valor >= 0 ? "text-brand-yellow" : "text-brand-red"}`}>{l.valor >= 0 ? "+" : "−"}{formatBRL(Math.abs(l.valor))}</b>
                                    {l.id
                                        ? <button onClick={() => excluir(l.id!)} className="p-2 text-foreground/40 hover:text-brand-red" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                        : <span className="w-8" />}
                                </span>
                            </div>
                        ))}
                        {conta.linhas.length > 8 && (
                            <button onClick={() => setTodos(!todos)} className="text-xs font-bold text-brand-yellow mt-2">{todos ? "Mostrar menos" : `Ver todos (${conta.linhas.length})`}</button>
                        )}
                    </>
                )}
            </div>
        </Card>
    );
}
