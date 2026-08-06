"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { formatCurrency } from "@/lib/format";
import {
    Bell, Check, Trash2, Tag, AlertTriangle, HandCoins, ArrowDownCircle,
    CheckCircle2, Info, Filter
} from "lucide-react";

interface Notificacao {
    id: string;
    tipo: 'classificar' | 'emprestimo_pendente' | 'limite_categoria' | 'devolucao_detectada' | 'geral';
    titulo: string;
    mensagem: string;
    lida: boolean;
    acao_url: string | null;
    created_at: string;
}

const tipoConfig: Record<string, { icon: any; color: string; bg: string }> = {
    classificar: { icon: Tag, color: 'text-brand-blue', bg: 'bg-brand-blue/10' },
    emprestimo_pendente: { icon: HandCoins, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    limite_categoria: { icon: AlertTriangle, color: 'text-brand-red', bg: 'bg-brand-red/10' },
    devolucao_detectada: { icon: ArrowDownCircle, color: 'text-brand-green', bg: 'bg-brand-green/10' },
    geral: { icon: Info, color: 'text-foreground/60', bg: 'bg-surface' },
};

export default function NotificacoesPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
    const [filtro, setFiltro] = useState<string>('todas');

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('notificacoes')
            .select('*')
            .eq('user_id', user!.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (data) setNotificacoes(data);
        setLoading(false);
    };

    const marcarLida = async (id: string) => {
        await supabase.from('notificacoes').update({ lida: true }).eq('id', id).eq('user_id', user!.id);
        setNotificacoes(notificacoes.map(n => n.id === id ? { ...n, lida: true } : n));
    };

    const marcarTodasLidas = async () => {
        await supabase.from('notificacoes').update({ lida: true }).eq('user_id', user!.id).eq('lida', false);
        setNotificacoes(notificacoes.map(n => ({ ...n, lida: true })));
    };

    const deletar = async (id: string) => {
        await supabase.from('notificacoes').delete().eq('id', id).eq('user_id', user!.id);
        setNotificacoes(notificacoes.filter(n => n.id !== id));
    };

    const filtradas = notificacoes.filter(n => {
        if (filtro === 'todas') return true;
        if (filtro === 'nao_lidas') return !n.lida;
        return n.tipo === filtro;
    });

    const naoLidas = notificacoes.filter(n => !n.lida).length;

    if (loading) return <div className="p-8 text-foreground/50 animate-pulse">Carregando notificações...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="pb-6 border-b border-borders flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
                        <Bell className="text-brand-blue w-6 h-6" /> Notificações
                        {naoLidas > 0 && (
                            <span className="bg-brand-red text-white text-xs font-bold px-2 py-0.5 rounded-full">{naoLidas}</span>
                        )}
                    </h1>
                    <p className="text-foreground/60 mt-1">Alertas de transações, limites e empréstimos.</p>
                </div>
                {naoLidas > 0 && (
                    <button
                        onClick={marcarTodasLidas}
                        className="bg-cards border border-borders hover:bg-white/5 text-foreground/70 font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition-all"
                    >
                        <CheckCircle2 className="w-4 h-4" /> Marcar todas como lidas
                    </button>
                )}
            </header>

            {/* Filtros */}
            <div className="flex flex-wrap gap-1 bg-cards border border-borders rounded-xl p-1">
                {[
                    { value: 'todas', label: 'Todas' },
                    { value: 'nao_lidas', label: 'Não lidas' },
                    { value: 'classificar', label: 'Classificação' },
                    { value: 'emprestimo_pendente', label: 'Empréstimos' },
                    { value: 'limite_categoria', label: 'Limites' },
                ].map(f => (
                    <button
                        key={f.value}
                        onClick={() => setFiltro(f.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtro === f.value ? 'bg-brand-blue/10 text-brand-blue' : 'text-foreground/50 hover:text-white'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Lista */}
            {filtradas.length === 0 ? (
                <div className="text-center py-12 bg-cards rounded-2xl border border-dashed border-borders">
                    <Bell className="w-10 h-10 text-foreground/30 mx-auto mb-3" />
                    <p className="text-foreground/50 font-medium">Nenhuma notificação</p>
                    <p className="text-sm text-foreground/40 mt-1">Você será notificado sobre transações e alertas aqui.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtradas.map(n => {
                        const cfg = tipoConfig[n.tipo] || tipoConfig.geral;
                        const Icon = cfg.icon;
                        return (
                            <div
                                key={n.id}
                                className={`bg-cards border rounded-xl p-4 flex items-start gap-3 group transition-all ${n.lida ? 'border-borders opacity-60' : 'border-brand-blue/30 bg-brand-blue/[0.02]'}`}
                            >
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className={`font-bold text-sm ${n.lida ? 'text-foreground/70' : 'text-white'}`}>{n.titulo}</p>
                                            <p className="text-xs text-foreground/50 mt-0.5">{n.mensagem}</p>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {!n.lida && (
                                                <button onClick={() => marcarLida(n.id)} className="p-1.5 text-foreground/40 hover:text-brand-green rounded-lg hover:bg-white/5 transition-all" title="Marcar como lida">
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button onClick={() => deletar(n.id)} className="p-1.5 text-foreground/40 hover:text-brand-red rounded-lg hover:bg-white/5 transition-all" title="Excluir">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-foreground/30 mt-1">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
                                </div>
                                {!n.lida && <div className="w-2 h-2 rounded-full bg-brand-blue flex-shrink-0 mt-1.5"></div>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
