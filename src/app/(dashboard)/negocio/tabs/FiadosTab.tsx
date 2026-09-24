"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Check, MessageCircle, Plus, Undo2, X, Phone } from "lucide-react";
import { FrangoData, FORMAS, fiadosAbertos, historicoCliente, linkWhatsApp, hoje, dataCurta, formatBRL } from "../calc";
import { clientePorNome } from "../data";
import { Card, CampoNumero, inputCls, labelCls, btnPrimario, btnSecundario, n, inteiro, Vazio } from "../ui";

type Props = { d: FrangoData; userId: string; recarregar: () => Promise<void> };
type Forma = 'dinheiro' | 'pix' | 'cartao';

export function FiadosTab({ d, userId, recarregar }: Props) {
    const abertos = useMemo(() => fiadosAbertos(d), [d]);
    const [recebendo, setRecebendo] = useState<string | null>(null);
    const [valorRec, setValorRec] = useState("");
    const [forma, setForma] = useState<Forma>('pix');
    const [clienteAberto, setClienteAberto] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState(false);

    const clientePorId = new Map(d.clientes.map(c => [c.id, c]));
    const totalAberto = abertos.reduce((s, f) => s + f.aberto, 0);

    const abrirRecebimento = (id: string, saldo: number) => { setRecebendo(id); setValorRec(String(saldo)); setForma('pix'); };

    const receber = async (fiadoId: string, saldo: number) => {
        const v = Math.min(n(valorRec), saldo);
        if (!(v > 0)) return alert("Informe o valor recebido.");
        setOcupado(true);
        const { error } = await supabase.from('frango_recebimentos').insert({ user_id: userId, fiado_id: fiadoId, data: hoje(), valor: v, forma });
        if (!error && v >= saldo) {
            await supabase.from('frango_fiados').update({ status: 'pago', data_baixa: hoje() }).eq('id', fiadoId);
        }
        setOcupado(false);
        if (error) return alert("Erro: " + error.message);
        setRecebendo(null);
        await recarregar();
    };

    const perdido = async (fiadoId: string, nome: string, saldo: number) => {
        if (!confirm(`Dar como perdido o fiado de ${nome} (${formatBRL(saldo)})? Entra como prejuízo no mês de hoje.`)) return;
        const { error } = await supabase.from('frango_fiados').update({ status: 'perdido', data_baixa: hoje() }).eq('id', fiadoId);
        if (error) return alert("Erro: " + error.message);
        await recarregar();
    };

    const salvarTelefone = async (clienteId: string, nome: string) => {
        const tel = prompt(`Telefone de ${nome} com DDD (só números):`, clientePorId.get(clienteId)?.telefone || "");
        if (tel === null) return;
        const { error } = await supabase.from('frango_clientes').update({ telefone: tel.replace(/\D/g, "") || null }).eq('id', clienteId);
        if (error) return alert("Erro: " + error.message);
        await recarregar();
    };

    // recebidos recentes (para desfazer engano)
    const recentes = useMemo(() => [...d.recebimentos]
        .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id))
        .slice(0, 8), [d.recebimentos]);

    const desfazer = async (recId: string, fiadoId: string) => {
        if (!confirm("Desfazer este recebimento? O fiado volta a ficar em aberto.")) return;
        const { error } = await supabase.from('frango_recebimentos').delete().eq('id', recId);
        if (!error) await supabase.from('frango_fiados').update({ status: 'aberto', data_baixa: null }).eq('id', fiadoId);
        if (error) return alert("Erro: " + error.message);
        await recarregar();
    };

    return (
        <div className="space-y-6">
            <Card titulo="Fiados em aberto" extra={<span className="text-sm font-bold text-brand-yellow">{formatBRL(totalAberto)}</span>}>
                {abertos.length === 0 ? <Vazio>Ninguém devendo. 🎉</Vazio> : (
                    <div className="space-y-2">
                        {abertos.map(f => {
                            const cli = clientePorId.get(f.cliente_id);
                            const nome = cli?.nome || "?";
                            const wa = cli ? linkWhatsApp(d.config.template_whatsapp, cli, f.aberto, f.data) : null;
                            const hist = clienteAberto === f.cliente_id ? historicoCliente(d, f.cliente_id) : null;
                            return (
                                <div key={f.id} className={`bg-surface border rounded-xl px-4 py-3 ${f.dias > 30 ? "border-brand-red/40" : "border-borders"}`}>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <button onClick={() => setClienteAberto(clienteAberto === f.cliente_id ? null : f.cliente_id)} className="text-white font-bold hover:underline">{nome}</button>
                                            <p className="text-xs text-foreground/60">
                                                {dataCurta(f.data)} · {f.dias === 0 ? "hoje" : `${f.dias} dias`}
                                                {f.dias > 30 && <span className="text-brand-red font-bold"> · atrasado</span>}
                                                {f.aberto < f.valor && <span> · de {formatBRL(f.valor)}</span>}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-brand-yellow mr-1">{formatBRL(f.aberto)}</span>
                                            <button onClick={() => abrirRecebimento(f.id, f.aberto)} className="text-sm font-bold px-3 py-1.5 rounded-lg bg-brand-green/15 text-brand-green hover:bg-brand-green/25">Recebeu</button>
                                            {wa
                                                ? <a href={wa} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-brand-green hover:bg-white/5" title="Cobrar no WhatsApp"><MessageCircle className="w-4 h-4" /></a>
                                                : <button onClick={() => salvarTelefone(f.cliente_id, nome)} className="p-2 rounded-lg text-foreground/40 hover:text-white hover:bg-white/5" title="Adicionar telefone para cobrar no WhatsApp"><Phone className="w-4 h-4" /></button>}
                                            <button onClick={() => perdido(f.id, nome, f.aberto)} className="p-2 rounded-lg text-foreground/40 hover:text-brand-red hover:bg-white/5" title="Não vai pagar"><X className="w-4 h-4" /></button>
                                        </div>
                                    </div>

                                    {recebendo === f.id && (
                                        <div className="mt-3 pt-3 border-t border-borders flex flex-wrap items-end gap-3">
                                            <div className="w-36">
                                                <CampoNumero label="Valor recebido" prefixo="R$" step="0.01" value={valorRec} onChange={setValorRec}
                                                    dica={n(valorRec) < f.aberto ? `fica faltando ${formatBRL(f.aberto - n(valorRec))}` : "quita tudo"} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Como pagou</label>
                                                <div className="p-1 bg-background rounded-xl flex gap-1 border border-borders">
                                                    {FORMAS.map(fm => (
                                                        <button key={fm.id} onClick={() => setForma(fm.id)}
                                                            className={`px-3 py-1.5 text-sm font-bold rounded-lg ${forma === fm.id ? 'bg-brand-yellow/20 text-brand-yellow' : 'text-foreground/50 hover:text-white'}`}>
                                                            {fm.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pb-5">
                                                <button onClick={() => receber(f.id, f.aberto)} disabled={ocupado} className="text-sm font-bold px-4 py-2 rounded-lg bg-brand-green text-background disabled:opacity-50"><Check className="w-4 h-4 inline mr-1" />Confirmar</button>
                                                <button onClick={() => setRecebendo(null)} className={btnSecundario}>Cancelar</button>
                                            </div>
                                        </div>
                                    )}

                                    {hist && (
                                        <div className="mt-3 pt-3 border-t border-borders text-xs text-foreground/70 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <p>Já deixou fiado: <b className="text-white">{hist.vezes}×</b></p>
                                            <p>Total: <b className="text-white">{formatBRL(hist.total)}</b></p>
                                            <p>Demora pra pagar: <b className="text-white">{hist.tempoMedio === null ? "—" : `${hist.tempoMedio} dias`}</b></p>
                                            <p>Perdido: <b className={hist.perdido > 0 ? "text-brand-red" : "text-white"}>{formatBRL(hist.perdido)}</b></p>
                                            {cli?.telefone && <button onClick={() => salvarTelefone(f.cliente_id, nome)} className="text-left underline">Tel: {cli.telefone}</button>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FiadoAntigo d={d} userId={userId} recarregar={recarregar} />

                <Card titulo="Recebidos recentemente">
                    {recentes.length === 0 ? <Vazio>Nenhum recebimento ainda.</Vazio> : (
                        <div className="space-y-2">
                            {recentes.map(r => {
                                const f = d.fiados.find(x => x.id === r.fiado_id);
                                const nome = f ? clientePorId.get(f.cliente_id)?.nome : "?";
                                return (
                                    <div key={r.id} className="flex items-center justify-between gap-3 text-sm bg-surface border border-borders rounded-xl px-4 py-2">
                                        <p className="text-foreground/80"><b className="text-white">{nome}</b> · {dataCurta(r.data)} · {FORMAS.find(x => x.id === r.forma)?.label}</p>
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold text-brand-green">{formatBRL(r.valor)}</span>
                                            <button onClick={() => desfazer(r.id, r.fiado_id)} className="p-1.5 text-foreground/40 hover:text-brand-red" title="Desfazer"><Undo2 className="w-4 h-4" /></button>
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

/** Fiado de antes do app (ou fora de um fechamento). Só o recebimento entra como venda. */
function FiadoAntigo({ d, userId, recarregar }: Props) {
    const [cliente, setCliente] = useState("");
    const [data, setData] = useState(hoje());
    const [valor, setValor] = useState("");
    const [qtd, setQtd] = useState("1");
    const [salvando, setSalvando] = useState(false);

    const salvar = async () => {
        if (!cliente.trim() || !(n(valor) > 0)) return alert("Informe o nome e o valor.");
        setSalvando(true);
        try {
            const clienteId = await clientePorNome(userId, cliente, d.clientes);
            const { error } = await supabase.from('frango_fiados').insert({ user_id: userId, cliente_id: clienteId, data, qtd: inteiro(qtd), valor: n(valor) });
            if (error) throw error;
            setCliente(""); setValor(""); setQtd("1");
            await recarregar();
        } catch (e: any) {
            alert("Erro: " + (e?.message || e));
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Card titulo="Lançar fiado antigo">
            <p className="text-xs text-foreground/50 mb-3">Para quem já devia antes de começar a usar o app. Fiado de um dia de venda se lança no Fechar dia.</p>
            <datalist id="clientes-frango-antigo">{d.clientes.map(c => <option key={c.id} value={c.nome} />)}</datalist>
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <label className={labelCls}>Nome</label>
                    <input list="clientes-frango-antigo" value={cliente} onChange={e => setCliente(e.target.value)} className={inputCls} />
                </div>
                <div>
                    <label className={labelCls}>Data</label>
                    <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
                </div>
                <CampoNumero label="Valor" prefixo="R$" step="0.01" value={valor} onChange={setValor} />
                <CampoNumero label="Frangos" value={qtd} onChange={setQtd} />
                <div className="flex items-end">
                    <button onClick={salvar} disabled={salvando} className={`${btnPrimario} w-full py-2.5`}><Plus className="w-4 h-4" /> Lançar</button>
                </div>
            </div>
        </Card>
    );
}
