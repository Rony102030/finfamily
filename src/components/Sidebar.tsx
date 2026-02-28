"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useAppStore } from "@/store";
import {
    LayoutDashboard,
    Wallet,
    PiggyBank,
    Target,
    Repeat,
    BarChart2,
    Calculator,
    Bot,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight
} from "lucide-react";

export function Sidebar({ className }: { className?: string }) {
    const pathname = usePathname();
    const { signOut, user } = useAuth();
    const { activeMonth, setActiveMonth } = useAppStore();

    const navLinks = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/lancamentos", label: "Lançamentos", icon: Wallet },
        { href: "/fundos", label: "Fundos", icon: PiggyBank },
        { href: "/metas", label: "Metas", icon: Target },
        { href: "/recorrentes", label: "Recorrentes", icon: Repeat },
        { href: "/relatorios", label: "Relatórios", icon: BarChart2 },
        { href: "/calculadora", label: "Calculadora", icon: Calculator },
        { href: "/antigravity", label: "AntiGravity IA", icon: Bot },
        { href: "/configuracoes", label: "Configurações", icon: Settings },
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
            {/* Brand */}
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-green/20 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-brand-green" />
                    </div>
                    <div>
                        <h1 className="font-heading font-bold text-xl text-white">FinFamily</h1>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                {navLinks.map((link) => {
                    const isActive = pathname === link.href || (pathname !== "/dashboard" && pathname.startsWith(link.href));
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isActive
                                ? "bg-brand-green/10 text-brand-green"
                                : "text-foreground/70 hover:bg-white/5 hover:text-white"
                                }`}
                        >
                            <link.icon className="w-5 h-5" />
                            <span className="font-medium text-sm">{link.label}</span>
                        </Link>
                    );
                })}
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
                    <Link href="/configuracoes" className="flex flex-col hover:opacity-80 transition-opacity" title="Editar Perfil">
                        <div className="w-8 h-8 rounded-full bg-brand-green/20 border border-brand-green/30 flex items-center justify-center text-brand-green font-bold text-sm mb-1">
                            {user?.user_metadata?.display_name ? user.user_metadata.display_name.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || "U")}
                        </div>
                        <span className="text-xs font-bold text-white truncate max-w-[140px]">
                            {user?.user_metadata?.display_name || user?.email?.split('@')[0] || "Usuário"}
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
