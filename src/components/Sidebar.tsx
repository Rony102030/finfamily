"use client";

import { useState, useEffect } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useAppStore } from "@/store";
import {
    LayoutDashboard,
    Wallet,
    PiggyBank,
    Repeat,
    BarChart2,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Briefcase,
    Bell,
    Drumstick,
    Lock
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useNegociosAcesso } from "@/lib/negocios";

/** onNavigate: chamado ao tocar num link (no celular, fecha o menu na hora). */
export function Sidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
    const pathname = usePathname();
    const { signOut, user } = useAuth();
    const { activeMonth, setActiveMonth, userConfig } = useAppStore();
    const [showNotifications, setShowNotifications] = useState(false);
    const [hasUnreadUpdates, setHasUnreadUpdates] = useState(false);
    const modulos = useNegociosAcesso(user?.id);
    const [negocioNome, setNegocioNome] = useState("Hora do Frango");

    useEffect(() => {
        if (!user || !modulos?.has('frango')) return;
        supabase.from('frango_config').select('nome').eq('user_id', user.id).maybeSingle()
            .then(({ data }) => { if (data?.nome) setNegocioNome(data.nome); });
    }, [user, modulos]);

    // Negócios: só os módulos liberados para a conta; sem nenhum, aparece com cadeado
    const negocioItems = modulos === null ? [] : modulos.size === 0
        ? [{ href: "/negocio", label: "Negócios", icon: Lock }]
        : [
            ...(modulos.has('frango') ? [{ href: "/negocio", label: negocioNome, icon: Drumstick }] : []),
            ...(modulos.has('servico_extra') ? [{ href: "/servico-extra", label: userConfig?.servico_extra_nome || "Serviço Extra", icon: Briefcase }] : []),
        ];

    // Updates List
    const LATEST_UPDATE_VERSION = "v3-2026-03-15";

    useEffect(() => {
        const readVersion = localStorage.getItem('finfamily_updates_read');
        if (readVersion !== LATEST_UPDATE_VERSION) {
            setHasUnreadUpdates(true);
        }
    }, []);

    const toggleNotifications = () => {
        const newState = !showNotifications;
        setShowNotifications(newState);

        if (newState && hasUnreadUpdates) {
            setHasUnreadUpdates(false);
            localStorage.setItem('finfamily_updates_read', LATEST_UPDATE_VERSION);
        }
    };

    // Updates List
    const latestUpdates = [
        {
            title: "Filtro de Data nos Lançamentos",
            desc: "Adicionamos um novo filtro por data exata na tela de Lançamentos."
        },
        {
            title: "Data Visível na Listagem",
            desc: "Agora você pode visualizar facilmente a data de cada lançamento de forma elegante ao lado do nome."
        },
        {
            title: "Recuperação de Senha Corrigida",
            desc: "Resolvemos um problema onde links expirados de recuperação de senha redirecionavam para uma tela vazia."
        }
    ];

    const navSections = [
        {
            items: [
                { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
                { href: "/lancamentos", label: "Lançamentos", icon: Wallet },
                { href: "/caixinhas", label: "Caixinhas", icon: PiggyBank },
                { href: "/recorrentes", label: "Recorrentes", icon: Repeat },
            ],
        },
        {
            label: "Ferramentas",
            items: [
                { href: "/relatorios", label: "Relatórios", icon: BarChart2 },
            ],
        },
        {
            label: "Negócios",
            items: negocioItems,
        },
        {
            items: [
                { href: "/configuracoes", label: "Configurações", icon: Settings },
            ],
        },
    ];

    const handlePrevMonth = () => {
        const [year, month] = activeMonth.split("-").map(Number);
        const date = new Date(year, month - 2, 1);
        setActiveMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    const handleNextMonth = () => {
        const [year, month] = activeMonth.split("-").map(Number);
        const date = new Date(year, month, 1);
        setActiveMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const displayMonth = () => {
        if (!activeMonth) return "";
        const [y, m] = activeMonth.split("-");
        const mName = monthNames[parseInt(m) - 1];
        return `${mName} ${y}`;
    };

    return (
        <aside className={`flex flex-col h-full bg-surface border-r border-borders w-[230px] flex-shrink-0 ${className}`}>
            {/* Brand and Notifications */}
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-green/20 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-brand-green" />
                        </div>
                        <div>
                            <h1 className="font-heading font-bold text-xl text-white">FinFamily</h1>
                        </div>
                    </div>

                    <div className="relative">
                        <button
                            onClick={toggleNotifications}
                            className="p-1.5 rounded-lg text-foreground/50 hover:text-white hover:bg-white/5 transition-colors relative"
                            title="Novidades"
                        >
                            <Bell className="w-5 h-5" />
                            {hasUnreadUpdates && (
                                <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-brand-green"></span>
                            )}
                        </button>

                        {showNotifications && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                                <div className="absolute top-full right-0 md:left-full md:right-auto md:top-0 mt-2 md:mt-0 md:ml-4 w-[260px] md:w-[280px] bg-cards border border-borders rounded-xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-borders/50">
                                        <Bell className="w-4 h-4 text-brand-green" />
                                        <h3 className="font-bold text-white text-sm">Novidades de Hoje</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {latestUpdates.map((update, i) => (
                                            <div key={i}>
                                                <p className="font-bold text-xs text-brand-green">{update.title}</p>
                                                <p className="text-xs text-foreground/70 mt-0.5 leading-relaxed">{update.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                {navSections.filter(section => section.items.length > 0).map((section, sIdx) => (
                    <div key={sIdx} className={sIdx > 0 ? "pt-3 mt-3 border-t border-borders/50" : ""}>
                        {section.label && (
                            <p className="px-3 mb-1.5 text-[10px] uppercase font-bold text-foreground/40 tracking-wider">{section.label}</p>
                        )}
                        {section.items.map((link) => {
                            const isActive = pathname === link.href || (pathname !== "/dashboard" && pathname.startsWith(link.href));
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={onNavigate}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                                        (link as any).sub ? 'ml-4' : ''
                                    } ${isActive
                                        ? "bg-brand-green/10 text-brand-green"
                                        : "text-foreground/70 hover:bg-white/5 hover:text-white"
                                        }`}
                                >
                                    <link.icon className="w-5 h-5" />
                                    <span className="font-medium text-sm">{link.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Month Selector Footer */}
            <div className="p-4 border-t border-borders">
                <div className="bg-background rounded-xl p-1 mb-4 flex items-center justify-between border border-borders">
                    <button
                        onClick={handlePrevMonth}
                        className="p-2 hover:bg-white/5 rounded-lg text-foreground/70 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-semibold tracking-wide text-brand-green">
                        {displayMonth()}
                    </span>
                    <button
                        onClick={handleNextMonth}
                        className="p-2 hover:bg-white/5 rounded-lg text-foreground/70 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* User / Logout */}
                <div className="flex items-center justify-between px-2">
                    <Link href="/perfil" onClick={onNavigate} className="flex flex-col hover:opacity-80 transition-opacity" title="Meu perfil">
                        {user?.user_metadata?.avatar_url ? (
                            <img src={user.user_metadata.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border border-brand-green mb-1" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-brand-green/20 border border-brand-green/30 flex items-center justify-center text-brand-green font-bold text-sm mb-1">
                                {user?.user_metadata?.display_name ? user.user_metadata.display_name.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || "U")}
                            </div>
                        )}
                        <span className="text-xs font-bold text-white truncate max-w-[140px]">
                            {user?.user_metadata?.display_name || user?.email?.charAt(0).toUpperCase() || "Usuário"}
                        </span>
                    </Link>
                    <button
                        onClick={signOut}
                        className="text-foreground/50 hover:text-brand-red transition-colors p-2"
                        title="Sair"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
