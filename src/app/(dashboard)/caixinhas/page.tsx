"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { formatMonth, formatCurrency } from "@/lib/format";
import {
    useCaixinhas, saldoCaixinha, guardadoNoMes, mesesAte, hojeLocal, efeitoNoSaldo,
    Caixinha, DadosCaixinhas,
} from "@/lib/caixinhas";
import { PiggyBank, Plus, CalendarPlus, Pencil, History, ArchiveRestore, Trash2, AlertTriangle } from "lucide-react";
import { Icone, ICONES, Modal, CampoValor, inputCls, labelCls, btnPrimario, btnSecundario, n } from "./componentes";

type Painel =
    | { tipo: 'mover'; caixinha: Caixinha; acao: 'guardar' | 'resgatar' }
    | { tipo: 'gasto'; caixinha: Caixinha }
    | { tipo: 'editar'; caixinha: Caixinha | null }
    | { tipo: 'extrato'; caixinha: Caixinha }
    | { tipo: 'mes' };

export default function CaixinhasPage() {
    const { user } = useAuth();
    const { activeMonth } = useAppStore();
    const { dados, erro, carregando, recarregar } = useCaixinhas(user?.id, activeMonth);
    const [painel, setPainel] = useState<Painel | null>(null);
    const [verArquivadas, setVerArquivadas] = useState(false);

    if (carregando) return <div className="p-8 text-foreground/50 animate-pulse">Carregando caixinhas...</div>;
    if (erro === 'SEM_TABELAS') return (
        <div className="bg-cards border border-brand-yellow/40 rounded-2xl p-6 text-sm text-foreground/80 max-w-xl">
            <p className="font-bold text-white">Falta criar as caixinhas no banco.</p>
            <p>Rode o arquivo <code className="text-brand-yellow">migration_caixinhas.sql</code> no Supabase (SQL Editor) e recarregue.</p>
        </div>
    );
    if (erro || !dados || !user) return <div className="p-6 text-brand-red">Erro ao carregar: {erro}</div>;

    const d = dados;
    const ativas = d.caixinhas.filter(c => !c.arquivada);
    const arquivadas = d.caixinhas.filter(c => c.arquivada);
    const total = d.caixinhas.reduce((s, c) => s + saldoCaixinha(c, d.movimentos, d.gastos), 0);
    const guardadoMes = guardadoNoMes(d.movimentos, activeMonth);
    const fechar = () => setPainel(null);
    const aoSalvar = async () => { await recarregar(); fechar(); };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="pb-6 border-b border-borders flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
                        <PiggyBank className="text-brand-green w-6 h-6" /> Caixinhas
                    </h1>
                    <p className="text-foreground/60 mt-1">Seu dinheiro guardado por objetivo.</p>
                    <div className="flex flex-wrap gap-2 mt-4">
                        <button onClick={() => setPainel({ tipo: 'mes' })} className={btnPrimario}><CalendarPlus className="w-4 h-4" /> Guardar do mês</button>
                        <button onClick={() => setPainel({ tipo: 'editar', caixinha: null })} className={btnSecundario}><Plus className="w-4 h-4 inline mr-1" />Nova caixinha</button>
                    </div>
                </div>
                <div className="text-right space-y-2">
                    <div className="bg-brand-green/10 border border-brand-green/20 px-4 py-2 rounded-xl">
                        <p className="text-xs text-brand-green font-bold uppercase tracking-wider">Total guardado</p>
                        <p className="text-2xl font-bold text-white">{formatCurrency(total)}</p>
                    </div>
                    <p className="text-xs text-foreground/60">
                        Guardado em {formatMonth(activeMonth)}: <b className="text-white">{formatCurrency(guardadoMes)}</b>
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {ativas.map(c => <Card key={c.id} c={c} d={d} abrir={setPainel} />)}
            </div>

            {arquivadas.length > 0 && (
                <div>
                    <button onClick={() => setVerArquivadas(!verArquivadas)} className="text-sm text-foreground/60 hover:text-white">
                        {verArquivadas ? "Esconder" : "Ver"} arquivadas ({arquivadas.length})
                    </button>
                    {verArquivadas && (
                        <div className="mt-3 space-y-2">
                            {arquivadas.map(c => (
                                <div key={c.id} className="flex items-center justify-between gap-3 bg-surface border border-borders rounded-xl px-4 py-2.5">
                                    <p className="text-foreground/70 flex items-center gap-2"><Icone nome={c.icone} className="w-4 h-4" />{c.nome} · {formatCurrency(saldoCaixinha(c, d.movimentos, d.gastos))}</p>
                                    <button className={btnSecundario} onClick={async () => { await supabase.from('caixinhas').update({ arquivada: false }).eq('id', c.id); recarregar(); }}>
                                        <ArchiveRestore className="w-4 h-4 inline mr-1" />Reativar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {painel?.tipo === 'mover' && <Mover p={painel} d={d} userId={user.id} onClose={fechar} onSaved={aoSalvar} />}
            {painel?.tipo === 'gasto' && <GastoReserva d={d} userId={user.id} onClose={fechar} onSaved={aoSalvar} />}
            {painel?.tipo === 'editar' && <Editar c={painel.caixinha} d={d} userId={user.id} onClose={fechar} onSaved={aoSalvar} />}
            {painel?.tipo === 'extrato' && <Extrato c={painel.caixinha} d={d} onClose={fechar} recarregar={recarregar} />}
            {painel?.tipo === 'mes' && <GuardarDoMes d={d} mes={activeMonth} userId={user.id} onClose={fechar} onSaved={aoSalvar} />}
        </div>
    );
}

function Card({ c, d, abrir }: { c: Caixinha; d: DadosCaixinhas; abrir: (p: Painel) => void }) {
    const saldo = saldoCaixinha(c, d.movimentos, d.gastos);
    const emerg = c.tipo === 'emergencia';
    const meta = c.meta ?? (emerg && d.mediaDespesas > 0 ? Math.round(d.mediaDespesas * 6) : null);
    const pct = meta ? Math.min(100, Math.max(0, Math.round((saldo / meta) * 100))) : null;
    const hoje = hojeLocal();

    let info: React.ReactNode = null;
    if (emerg) {
        const meses = d.mediaDespesas > 0 ? saldo / d.mediaDespesas : null;
        info = meses === null
            ? <span>Lance despesas para calcular quantos meses a reserva cobre.</span>
            : <span className={meses < 3 ? "text-brand-yellow" : ""}>Cobre <b className="text-white">{meses.toFixed(1).replace('.', ',')} meses</b> das suas despesas</span>;
    } else if (meta && c.prazo) {
        const falta = Math.max(0, meta - saldo);
        const meses = mesesAte(c.prazo, hoje);
        info = falta === 0 ? <span className="text-brand-green">Meta alcançada</span>
            : <span>Até {c.prazo.slice(5, 7)}/{c.prazo.slice(0, 4)}: guarde <b className="text-white">{formatCurrency(falta / meses)}</b>/mês</span>;
    } else if (meta) {
        info = saldo >= meta ? <span className="text-brand-green">Meta alcançada</span> : <span>Faltam {formatCurrency(meta - saldo)}</span>;
    }

    return (
        <div className="bg-cards border border-borders rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${emerg ? "bg-brand-blue/15 text-brand-blue" : "bg-brand-green/15 text-brand-green"}`}>
                        <Icone nome={c.icone} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-white truncate">{c.nome}</p>
                        {c.onde && <p className="text-xs text-foreground/50 truncate">{c.onde}</p>}
                    </div>
                </div>
                <div className="flex -mr-1">
                    <button onClick={() => abrir({ tipo: 'extrato', caixinha: c })} className="p-1.5 text-foreground/40 hover:text-white rounded-lg hover:bg-white/5" title="Extrato"><History className="w-4 h-4" /></button>
                    <button onClick={() => abrir({ tipo: 'editar', caixinha: c })} className="p-1.5 text-foreground/40 hover:text-white rounded-lg hover:bg-white/5" title="Editar ou excluir"><Pencil className="w-4 h-4" /></button>
                </div>
            </div>

            <p className={`text-2xl font-bold ${saldo < 0 ? "text-brand-red" : "text-white"}`}>{formatCurrency(saldo)}</p>

            {pct !== null && (
                <div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${emerg ? "bg-brand-blue" : "bg-brand-green"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-foreground/50 mt-1">{pct}% de {formatCurrency(meta!)}{emerg && c.meta === null ? " (6 meses de despesas)" : ""}</p>
                </div>
            )}
            {info && <p className="text-xs text-foreground/70">{info}</p>}

            <div className="flex gap-2 mt-auto pt-1">
                <button onClick={() => abrir({ tipo: 'mover', caixinha: c, acao: 'guardar' })} className="flex-1 text-sm font-bold py-2 rounded-lg border border-brand-green text-brand-green hover:bg-white/5">Guardar</button>
                {emerg
                    ? <button onClick={() => abrir({ tipo: 'gasto', caixinha: c })} className="flex-1 text-sm font-bold py-2 rounded-lg border border-borders text-foreground/80 hover:text-white hover:bg-white/5">Usar reserva</button>
                    : <button onClick={() => abrir({ tipo: 'mover', caixinha: c, acao: 'resgatar' })} className="flex-1 text-sm font-bold py-2 rounded-lg border border-borders text-foreground/80 hover:text-white hover:bg-white/5">Resgatar</button>}
            </div>
        </div>
    );
}

type ModalProps = { d: DadosCaixinhas; userId: string; onClose: () => void; onSaved: () => Promise<void> };

function Mover({ p, d, userId, onClose, onSaved }: ModalProps & { p: { caixinha: Caixinha; acao: 'guardar' | 'resgatar' } }) {
    const c = p.caixinha;
    const guardar = p.acao === 'guardar';
    const saldo = saldoCaixinha(c, d.movimentos, d.gastos);
    const [valor, setValor] = useState(guardar && c.valor_mensal ? String(c.valor_mensal) : "");
    const [data, setData] = useState(hojeLocal());
    const [descricao, setDescricao] = useState("");
    const [salvando, setSalvando] = useState(false);

    const salvar = async () => {
        const v = n(valor);
        if (!(v > 0)) return alert("Informe o valor.");
        if (!guardar && v > saldo && !confirm(`O saldo é ${formatCurrency(saldo)}. Resgatar ${formatCurrency(v)} mesmo assim?`)) return;
        setSalvando(true);
        const { error } = await supabase.from('caixinha_movimentos').insert({
            user_id: userId, caixinha_id: c.id, data, mes: data.slice(0, 7), tipo: p.acao, valor: v, descricao: descricao.trim() || null,
        });
        setSalvando(false);
        if (error) return alert("Erro: " + error.message);
        await onSaved();
    };

    return (
        <Modal titulo={`${guardar ? "Guardar em" : "Resgatar de"} ${c.nome}`} onClose={onClose}>
            <div className="space-y-4">
                <CampoValor label="Valor" value={valor} onChange={setValor} autoFocus
                    dica={guardar ? `Sai do Líquido p/ Gastos de ${formatMonth(data.slice(0, 7))}.` : `Volta para o Líquido p/ Gastos de ${formatMonth(data.slice(0, 7))}. Saldo: ${formatCurrency(saldo)}.`} />
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Data</label>
                        <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Descrição (opcional)</label>
                        <input value={descricao} onChange={e => setDescricao(e.target.value)} className={inputCls} />
                    </div>
                </div>
                <button onClick={salvar} disabled={salvando} className={`${btnPrimario} w-full`}>{salvando ? "Salvando..." : guardar ? "Guardar" : "Resgatar"}</button>
            </div>
        </Modal>
    );
}

function GastoReserva({ d, userId, onClose, onSaved }: ModalProps) {
    const [descricao, setDescricao] = useState("");
    const [valor, setValor] = useState("");
    const [data, setData] = useState(hojeLocal());
    const [carteiraId, setCarteiraId] = useState(d.carteiras[0]?.id || "");
    const [status, setStatus] = useState<'pago' | 'pendente'>('pago');
    const [salvando, setSalvando] = useState(false);

    const salvar = async () => {
        if (!d.categoriaEmergenciaId) return;
        if (!descricao.trim() || !(n(valor) > 0)) return alert("Informe a descrição e o valor.");
        setSalvando(true);
        // Mesmo lançamento que a antiga tela de Emergência criava: aparece em Lançamentos e fica fora das despesas do mês.
        const { error } = await supabase.from('lancamentos').insert({
            user_id: userId, tipo: 'despesa', descricao: descricao.trim(), valor: n(valor), data, mes: data.slice(0, 7),
            carteira_id: carteiraId || null, status, categoria_id: d.categoriaEmergenciaId, recorrente: false,
        });
        setSalvando(false);
        if (error) return alert("Erro: " + error.message);
        await onSaved();
    };

    return (
        <Modal titulo="Usar a reserva de emergência" onClose={onClose}>
            {!d.categoriaEmergenciaId ? (
                <p className="text-sm text-foreground/80">Crie uma categoria chamada <b className="text-white">Emergência</b> em Configurações → Categorias para registrar gastos pagos com a reserva.</p>
            ) : (
                <div className="space-y-4">
                    <p className="text-xs text-foreground/60">Vira um lançamento na categoria Emergência: aparece em Lançamentos, sai da reserva e não entra nas despesas do mês.</p>
                    <div>
                        <label className={labelCls}>Com o que foi o gasto</label>
                        <input value={descricao} onChange={e => setDescricao(e.target.value)} className={inputCls} placeholder="Conserto do carro" autoFocus />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <CampoValor label="Valor" value={valor} onChange={setValor} />
                        <div>
                            <label className={labelCls}>Data</label>
                            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Carteira</label>
                            <select value={carteiraId} onChange={e => setCarteiraId(e.target.value)} className={inputCls}>
                                {d.carteiras.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Status</label>
                            <select value={status} onChange={e => setStatus(e.target.value as any)} className={inputCls}>
                                <option value="pago">Pago</option>
                                <option value="pendente">Pendente</option>
                            </select>
                        </div>
                    </div>
                    <button onClick={salvar} disabled={salvando} className={`${btnPrimario} w-full`}>{salvando ? "Salvando..." : "Registrar gasto"}</button>
                </div>
            )}
        </Modal>
    );
}

function Editar({ c, d, userId, onClose, onSaved }: ModalProps & { c: Caixinha | null }) {
    const emerg = c?.tipo === 'emergencia';
    const [nome, setNome] = useState(c?.nome || "");
    const [icone, setIcone] = useState(c?.icone || "piggy");
    const [meta, setMeta] = useState(c?.meta ? String(c.meta) : "");
    const [prazo, setPrazo] = useState(c?.prazo?.slice(0, 7) || "");
    const [mensal, setMensal] = useState(c?.valor_mensal ? String(c.valor_mensal) : "");
    const [onde, setOnde] = useState(c?.onde || "");
    const [salvando, setSalvando] = useState(false);
    const saldo = c ? saldoCaixinha(c, d.movimentos, d.gastos) : 0;
    const temMovimento = c ? d.movimentos.some(m => m.caixinha_id === c.id) : false;

    const salvar = async () => {
        if (!nome.trim()) return alert("Dê um nome para a caixinha.");
        setSalvando(true);
        const campos = {
            nome: nome.trim(), icone, meta: n(meta) > 0 ? n(meta) : null,
            prazo: prazo ? `${prazo}-01` : null, valor_mensal: n(mensal), onde: onde.trim() || null,
        };
        const { error } = c
            ? await supabase.from('caixinhas').update(campos).eq('id', c.id)
            : await supabase.from('caixinhas').insert({ user_id: userId, ...campos, ordem: 20 + d.caixinhas.length });
        setSalvando(false);
        if (error) return alert("Erro: " + error.message);
        await onSaved();
    };

    const arquivar = async () => {
        if (!c) return;
        if (saldo !== 0 && !confirm(`Ainda tem ${formatCurrency(saldo)} nesta caixinha. Arquivar mesmo assim? (o saldo continua contando no total)`)) return;
        await supabase.from('caixinhas').update({ arquivada: true }).eq('id', c.id);
        await onSaved();
    };

    const excluir = async () => {
        if (!c) return;
        const aviso = temMovimento
            ? `Excluir a caixinha ${c.nome} e todo o extrato dela (saldo ${formatCurrency(saldo)})?

O que foi guardado nela nos meses passados volta a contar no Líquido p/ Gastos desses meses. Se quiser só tirar da tela, use Arquivar.`
            : `Excluir a caixinha ${c.nome}?`;
        if (!confirm(aviso)) return;
        const { error } = await supabase.from('caixinhas').delete().eq('id', c.id);
        if (error) return alert("Erro: " + error.message);
        await onSaved();
    };

    return (
        <Modal titulo={c ? `Editar ${c.nome}` : "Nova caixinha"} onClose={onClose}>
            <div className="space-y-4">
                <div>
                    <label className={labelCls}>Nome</label>
                    <input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} placeholder="Viagem de férias" autoFocus={!c} />
                </div>
                <div>
                    <label className={labelCls}>Ícone</label>
                    <div className="flex flex-wrap gap-1.5">
                        {Object.keys(ICONES).map(k => (
                            <button key={k} type="button" onClick={() => setIcone(k)}
                                className={`w-9 h-9 rounded-lg flex items-center justify-center border ${icone === k ? "border-brand-green text-brand-green bg-brand-green/10" : "border-borders text-foreground/60 hover:text-white"}`}>
                                <Icone nome={k} className="w-4 h-4" />
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <CampoValor label={emerg ? "Meta (vazio = 6 meses de despesas)" : "Meta (opcional)"} value={meta} onChange={setMeta} />
                    <div>
                        <label className={labelCls}>Prazo (opcional)</label>
                        <input type="month" value={prazo} onChange={e => setPrazo(e.target.value)} className={inputCls} />
                    </div>
                    <CampoValor label="Guardar por mês" value={mensal} onChange={setMensal} dica="Sugestão no Guardar do mês" />
                    <div>
                        <label className={labelCls}>Onde está o dinheiro</label>
                        <input list="carteiras-caixinha" value={onde} onChange={e => setOnde(e.target.value)} className={inputCls} placeholder="PicPay" />
                        <datalist id="carteiras-caixinha">{d.carteiras.map(w => <option key={w.id} value={w.nome} />)}</datalist>
                    </div>
                </div>
                <button onClick={salvar} disabled={salvando} className={`${btnPrimario} w-full`}>{salvando ? "Salvando..." : "Salvar"}</button>
                {c && !emerg && (
                    <div className="flex justify-between pt-3 border-t border-borders">
                        <button onClick={arquivar} className={btnSecundario}>Arquivar</button>
                        <button onClick={excluir} className="text-sm font-medium py-2 px-3 rounded-lg border border-brand-red/40 text-brand-red hover:bg-brand-red/10 flex items-center gap-1.5"><Trash2 className="w-4 h-4" />Excluir caixinha</button>
                    </div>
                )}
                {emerg && <p className="text-xs text-foreground/50 pt-3 border-t border-borders">A reserva de emergência não pode ser excluída, mas dá para mudar nome, ícone, meta e onde está o dinheiro.</p>}
            </div>
        </Modal>
    );
}

function Extrato({ c, d, onClose, recarregar }: { c: Caixinha; d: DadosCaixinhas; onClose: () => void; recarregar: () => Promise<void> }) {
    const [ajustando, setAjustando] = useState(false);
    const [saldoReal, setSaldoReal] = useState("");
    const saldo = saldoCaixinha(c, d.movimentos, d.gastos);

    const linhas = useMemo(() => {
        const mov = d.movimentos.filter(m => m.caixinha_id === c.id).map(m => ({
            id: m.id, tipo: m.tipo, data: m.data, valor: efeitoNoSaldo(m),
            texto: m.descricao || (m.tipo === 'guardar' ? "Guardado" : m.tipo === 'resgatar' ? "Resgatado" : "Ajuste"),
            gasto: null as null | { group_id: string | null },
        }));
        const gastos = c.tipo === 'emergencia' ? d.gastos.map(g => ({
            id: g.id, tipo: 'gasto' as const, data: g.data, valor: -g.valor,
            texto: `${g.descricao}${g.status === 'pendente' ? " (pendente)" : ""}`, gasto: { group_id: g.group_id },
        })) : [];
        return [...mov, ...gastos].sort((a, b) => b.data.localeCompare(a.data));
    }, [c, d]);

    const excluir = async (l: typeof linhas[number]) => {
        if (l.gasto) {
            if (!confirm(l.gasto.group_id ? "Excluir este gasto e todas as parcelas dele? O valor volta para a reserva." : "Excluir este gasto? O valor volta para a reserva.")) return;
            const q = supabase.from('lancamentos').delete();
            const { error } = l.gasto.group_id ? await q.eq('group_id', l.gasto.group_id) : await q.eq('id', l.id);
            if (error) return alert("Erro: " + error.message);
        } else {
            if (!confirm("Excluir este movimento?")) return;
            const { error } = await supabase.from('caixinha_movimentos').delete().eq('id', l.id);
            if (error) return alert("Erro: " + error.message);
        }
        await recarregar();
    };

    const ajustar = async () => {
        const diff = Math.round((n(saldoReal) - saldo) * 100) / 100;
        if (diff === 0) return setAjustando(false);
        const hoje = hojeLocal();
        const { error } = await supabase.from('caixinha_movimentos').insert({
            caixinha_id: c.id, data: hoje, mes: hoje.slice(0, 7), tipo: 'ajuste', valor: diff,
            descricao: diff > 0 ? "Rendimento / ajuste" : "Ajuste",
        });
        if (error) return alert("Erro: " + error.message);
        setAjustando(false); setSaldoReal("");
        await recarregar();
    };

    const nomeTipo: Record<string, string> = { guardar: "guardado", resgatar: "resgatado", ajuste: "ajuste", gasto: "gasto da reserva" };

    return (
        <Modal titulo={`Extrato · ${c.nome}`} onClose={onClose} largo>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p className="text-sm text-foreground/70">Saldo: <b className="text-white text-lg">{formatCurrency(saldo)}</b></p>
                {!ajustando
                    ? <button onClick={() => { setSaldoReal(String(saldo)); setAjustando(true); }} className={btnSecundario}>Ajustar saldo / rendimento</button>
                    : (
                        <div className="flex items-end gap-2">
                            <div className="w-40"><CampoValor label="Saldo real hoje" value={saldoReal} onChange={setSaldoReal} /></div>
                            <button onClick={ajustar} className={`${btnPrimario} py-2.5`}>Ajustar</button>
                        </div>
                    )}
            </div>
            {ajustando && <p className="text-xs text-foreground/50 -mt-2 mb-3">Coloque o valor que está no banco. A diferença entra como rendimento/ajuste e não mexe no Líquido p/ Gastos.</p>}
            {linhas.length === 0 ? <p className="text-sm text-foreground/50 py-6 text-center">Nada por aqui ainda.</p> : (
                <div className="space-y-1.5">
                    {linhas.map(l => (
                        <div key={`${l.tipo}-${l.id}`} className="flex items-center justify-between gap-3 bg-surface border border-borders rounded-xl px-4 py-2 text-sm group">
                            <div className="min-w-0">
                                <p className="text-white truncate">{l.texto}</p>
                                <p className="text-xs text-foreground/50">{l.data.split("-").reverse().join("/")} · {nomeTipo[l.tipo]}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <span className={`font-bold ${l.valor >= 0 ? "text-brand-green" : "text-brand-red"}`}>{l.valor >= 0 ? "+" : "−"}{formatCurrency(Math.abs(l.valor))}</span>
                                <button onClick={() => excluir(l)} className="p-1.5 text-foreground/30 hover:text-brand-red sm:opacity-0 sm:group-hover:opacity-100" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}

function GuardarDoMes({ d, mes, userId, onClose, onSaved }: ModalProps & { mes: string }) {
    const ativas = d.caixinhas.filter(c => !c.arquivada);
    const jaGuardado = (id: string) => d.movimentos.filter(m => m.caixinha_id === id && m.mes === mes && m.tipo === 'guardar').reduce((s, m) => s + m.valor, 0);
    const [valores, setValores] = useState<Record<string, string>>(
        () => Object.fromEntries(ativas.map(c => [c.id, jaGuardado(c.id) > 0 ? "" : (c.valor_mensal ? String(c.valor_mensal) : "")])),
    );
    const [salvando, setSalvando] = useState(false);
    const total = ativas.reduce((s, c) => s + n(valores[c.id] || ""), 0);
    const guardadoAntes = guardadoNoMes(d.movimentos, mes);
    const algumJa = ativas.some(c => jaGuardado(c.id) > 0);
    const hoje = hojeLocal();
    const data = hoje.slice(0, 7) === mes ? hoje : `${mes}-01`;

    const salvar = async () => {
        const linhas = ativas.filter(c => n(valores[c.id] || "") > 0).map(c => ({
            user_id: userId, caixinha_id: c.id, data, mes, tipo: 'guardar', valor: n(valores[c.id]), descricao: "Guardar do mês",
        }));
        if (!linhas.length) return alert("Coloque o valor em pelo menos uma caixinha.");
        setSalvando(true);
        const { error } = await supabase.from('caixinha_movimentos').insert(linhas);
        setSalvando(false);
        if (error) return alert("Erro: " + error.message);
        await onSaved();
    };

    return (
        <Modal titulo={`Guardar do mês · ${formatMonth(mes)}`} onClose={onClose}>
            <div className="space-y-4">
                <p className="text-xs text-foreground/60">Já vem com o valor de sempre de cada caixinha. Mude o que quiser ou deixe em branco para pular.</p>
                {algumJa && (
                    <p className="text-xs text-brand-yellow flex items-start gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" />Algumas caixinhas já receberam dinheiro neste mês (mostrado ao lado). Elas vêm em branco para não guardar duas vezes.</p>
                )}
                <div className="space-y-2">
                    {ativas.map(c => (
                        <div key={c.id} className="flex items-center gap-3">
                            <Icone nome={c.icone} className="w-4 h-4 text-foreground/60 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{c.nome}</p>
                                {jaGuardado(c.id) > 0 && <p className="text-[11px] text-foreground/50">já guardado: {formatCurrency(jaGuardado(c.id))}</p>}
                            </div>
                            <div className="relative w-32">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-foreground/50">R$</span>
                                <input type="number" inputMode="decimal" step="0.01" min="0" value={valores[c.id] || ""} placeholder="0"
                                    onChange={e => setValores({ ...valores, [c.id]: e.target.value })}
                                    className="w-full bg-surface border border-borders rounded-lg pl-8 pr-2 py-2 text-white outline-none focus:border-brand-green" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="bg-surface border border-borders rounded-xl p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-foreground/70">Renda de {formatMonth(mes)}</span><span className="text-white">{formatCurrency(d.rendaMes)}</span></div>
                    {guardadoAntes !== 0 && <div className="flex justify-between"><span className="text-foreground/70">Já guardado no mês</span><span className="text-white">− {formatCurrency(guardadoAntes)}</span></div>}
                    <div className="flex justify-between"><span className="text-foreground/70">Guardar agora</span><span className="text-white">− {formatCurrency(total)}</span></div>
                    <div className="flex justify-between border-t border-borders pt-1 font-bold"><span className="text-white">Líquido p/ Gastos</span><span className="text-brand-green">{formatCurrency(d.rendaMes - guardadoAntes - total)}</span></div>
                </div>
                <button onClick={salvar} disabled={salvando} className={`${btnPrimario} w-full`}>{salvando ? "Guardando..." : `Guardar ${formatCurrency(total)}`}</button>
            </div>
        </Modal>
    );
}
