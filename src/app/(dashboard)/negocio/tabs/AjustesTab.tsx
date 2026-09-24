"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Check, Plus, Trash2 } from "lucide-react";
import { FrangoData, CustoFixo, Cliente, mesAtual, formatBRL } from "../calc";
import { Card, CampoNumero, inputCls, labelCls, btnPrimario, btnSecundario, n, inteiro, Vazio } from "../ui";

type Props = { d: FrangoData; userId: string; recarregar: () => Promise<void> };

export function AjustesTab(props: Props) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Config {...props} />
            <div className="space-y-6">
                <Fixos {...props} />
                <Clientes {...props} />
            </div>
        </div>
    );
}

function Config({ d, userId, recarregar }: Props) {
    const c = d.config;
    const [nome, setNome] = useState(c.nome);
    const [grande, setGrande] = useState(String(c.preco_grande));
    const [padrao, setPadrao] = useState(String(c.preco_padrao));
    const [kg, setKg] = useState(String(c.kg_por_caixa));
    const [meta, setMeta] = useState(String(c.meta_mensal));
    const [template, setTemplate] = useState(c.template_whatsapp);
    const [salvo, setSalvo] = useState(false);

    const salvar = async () => {
        const { error } = await supabase.from('frango_config').upsert({
            user_id: userId, nome: nome.trim() || "Meu Negócio", preco_grande: n(grande), preco_padrao: n(padrao),
            kg_por_caixa: n(kg) || 20, meta_mensal: inteiro(meta), template_whatsapp: template,
        }, { onConflict: 'user_id' });
        if (error) return alert("Erro: " + error.message);
        await recarregar();
        setSalvo(true);
        setTimeout(() => setSalvo(false), 2000);
    };

    return (
        <Card titulo="Configuração">
            <div className="space-y-3">
                <div>
                    <label className={labelCls}>Nome do negócio</label>
                    <input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <CampoNumero label="Preço frango grande" prefixo="R$" step="0.01" value={grande} onChange={setGrande} />
                    <CampoNumero label="Preço frango padrão" prefixo="R$" step="0.01" value={padrao} onChange={setPadrao} />
                    <CampoNumero label="Kg por caixa" step="0.5" value={kg} onChange={setKg} />
                    <CampoNumero label="Meta do mês (frangos)" value={meta} onChange={setMeta} />
                </div>
                <div>
                    <label className={labelCls}>Mensagem de cobrança no WhatsApp</label>
                    <textarea rows={3} value={template} onChange={e => setTemplate(e.target.value)} className={`${inputCls} resize-none text-sm`} />
                    <p className="text-[11px] text-foreground/50 mt-1">Use {"{nome}"}, {"{valor}"} e {"{data}"}.</p>
                </div>
                <p className="text-xs text-foreground/50">Mudar os preços vale para os próximos fechamentos. Os dias já fechados guardam o preço da época.</p>
                <button onClick={salvar} className={`${btnPrimario} w-full`}><Check className="w-5 h-5" /> {salvo ? "Salvo!" : "Salvar"}</button>
            </div>
        </Card>
    );
}

function Fixos({ d, userId, recarregar }: Props) {
    const [nome, setNome] = useState("");
    const [valor, setValor] = useState("");
    const mes = mesAtual();

    const adicionar = async () => {
        if (!nome.trim() || !(n(valor) > 0)) return alert("Informe nome e valor.");
        const { error } = await supabase.from('frango_custos_fixos').insert({ user_id: userId, nome: nome.trim(), valor: n(valor) });
        if (error) return alert("Erro: " + error.message);
        setNome(""); setValor("");
        await recarregar();
    };

    const alterarValor = async (f: CustoFixo, novo: string) => {
        const v = n(novo);
        if (v === f.valor || v < 0) return;
        const { error } = await supabase.from('frango_custos_fixos').update({ valor: v }).eq('id', f.id);
        if (error) return alert("Erro: " + error.message);
        const doMes = d.custos.find(c => c.fixo_id === f.id && c.mes === mes);
        if (doMes && confirm(`Aplicar ${formatBRL(v)} também ao ${f.nome} já lançado neste mês?`)) {
            await supabase.from('frango_custos').update({ valor: v }).eq('id', doMes.id);
        }
        await recarregar();
    };

    const alternar = async (f: CustoFixo) => {
        const { error } = await supabase.from('frango_custos_fixos').update({ ativo: !f.ativo }).eq('id', f.id);
        if (error) return alert("Erro: " + error.message);
        await recarregar();
    };

    const excluir = async (f: CustoFixo) => {
        if (!confirm(`Excluir o custo fixo ${f.nome}? Os meses já lançados continuam.`)) return;
        const { error } = await supabase.from('frango_custos_fixos').delete().eq('id', f.id);
        if (error) return alert("Erro: " + error.message);
        await recarregar();
    };

    const total = d.fixos.filter(f => f.ativo).reduce((s, f) => s + f.valor, 0);

    return (
        <Card titulo="Custos fixos do mês" extra={<span className="text-sm font-bold text-brand-red">{formatBRL(total)}</span>}>
            <p className="text-xs text-foreground/50 mb-3">Lançados sozinhos no dia 1 de cada mês. Dá para mudar o valor do mês em Compras.</p>
            {d.fixos.length === 0 ? <Vazio>Colaborador, energia, aluguel...</Vazio> : (
                <div className="space-y-2 mb-4">
                    {d.fixos.map(f => (
                        <div key={f.id} className={`flex items-center gap-2 bg-surface border border-borders rounded-xl px-3 py-2 ${f.ativo ? "" : "opacity-50"}`}>
                            <p className="flex-1 text-white font-medium truncate">{f.nome}</p>
                            <div className="relative w-28">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-foreground/50">R$</span>
                                <input type="number" step="0.01" defaultValue={f.valor} onBlur={e => alterarValor(f, e.target.value)}
                                    className="w-full bg-background border border-borders rounded-lg pl-7 pr-2 py-1.5 text-sm text-white outline-none focus:border-brand-yellow" />
                            </div>
                            <button onClick={() => alternar(f)} className="text-xs px-2 py-1 rounded-md border border-borders text-foreground/70 hover:text-white">{f.ativo ? "Pausar" : "Ativar"}</button>
                            <button onClick={() => excluir(f)} className="p-1.5 text-foreground/40 hover:text-brand-red"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Colaborador" className={`${inputCls} flex-1`} />
                <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="R$" className={`${inputCls} w-28`} />
                <button onClick={adicionar} className={btnSecundario}><Plus className="w-4 h-4" /></button>
            </div>
        </Card>
    );
}

function Clientes({ d, recarregar }: Props) {
    const salvar = async (c: Cliente, campo: 'nome' | 'telefone', valor: string) => {
        const v = campo === 'telefone' ? (valor.replace(/\D/g, "") || null) : valor.trim();
        if ((c[campo] || "") === (v || "") || (campo === 'nome' && !v)) return;
        const { error } = await supabase.from('frango_clientes').update({ [campo]: v }).eq('id', c.id);
        if (error) return alert("Erro: " + error.message);
        await recarregar();
    };

    const excluir = async (c: Cliente) => {
        if (d.fiados.some(f => f.cliente_id === c.id)) return alert(`${c.nome} tem fiados registrados e não pode ser excluído.`);
        if (!confirm(`Excluir ${c.nome}?`)) return;
        const { error } = await supabase.from('frango_clientes').delete().eq('id', c.id);
        if (error) return alert("Erro: " + error.message);
        await recarregar();
    };

    return (
        <Card titulo="Clientes do fiado">
            {d.clientes.length === 0 ? <Vazio>Os clientes aparecem aqui quando você lança o primeiro fiado.</Vazio> : (
                <div className="space-y-2">
                    {[...d.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map(c => (
                        <div key={c.id} className="flex items-center gap-2">
                            <input defaultValue={c.nome} onBlur={e => salvar(c, 'nome', e.target.value)} className={`${inputCls} flex-1 py-2`} />
                            <input defaultValue={c.telefone || ""} onBlur={e => salvar(c, 'telefone', e.target.value)} placeholder="Telefone c/ DDD" inputMode="tel" className={`${inputCls} w-40 py-2`} />
                            <button onClick={() => excluir(c)} className="p-1.5 text-foreground/40 hover:text-brand-red"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
