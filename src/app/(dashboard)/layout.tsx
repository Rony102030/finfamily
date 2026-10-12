"use client";

import { ProtectRoute } from "@/components/ProtectRoute";
import { Sidebar } from "@/components/Sidebar";
import { SeedManager } from "@/components/SeedManager";
import { GlobalShortcuts } from "@/components/GlobalShortcuts";
import { Wallet, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store";
import { preCarregarTelas } from "@/lib/dados";

// No celular o menu fica fechado, então o Next não pré-carrega as telas sozinho.
const TELAS = ["/dashboard", "/lancamentos", "/caixinhas", "/recorrentes", "/relatorios", "/negocio", "/perfil", "/configuracoes"];

/** Quando o app fica parado, baixa as outras telas e os dados do mês para a navegação ser instantânea. */
function usePreCarregamento() {
    const router = useRouter();
    const { user } = useAuth();
    const activeMonth = useAppStore(s => s.activeMonth);
    useEffect(() => {
        if (!user) return;
        const quandoParado = (fn: () => void) => {
            const w = window as any;
            if (w.requestIdleCallback) { const id = w.requestIdleCallback(fn, { timeout: 4000 }); return () => w.cancelIdleCallback(id); }
            const id = window.setTimeout(fn, 1500);
            return () => window.clearTimeout(id);
        };
        return quandoParado(() => {
            TELAS.forEach(t => router.prefetch(t));
            preCarregarTelas(user.id, activeMonth);
        });
    }, [user, activeMonth, router]);
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const router = useRouter();
    usePreCarregamento();

    useEffect(() => {
        // Redireciona o fluxo de redefinição de senha caso o Supabase mande para cá por padrão
        if (window.location.hash.includes("type=recovery")) {
            router.replace(`/update-password${window.location.hash}`);
        } else if (window.location.hash.includes("error_description=")) {
            // Manda para o login com o erro na URL se o token expirou
            router.replace(`/login${window.location.hash}`);
        }
    }, [router]);

    return (
        <ProtectRoute>
            <div className="flex h-screen overflow-hidden bg-background">
                {/* Sidebar desktop */}
                <Sidebar className="w-[230px] flex-shrink-0 hidden md:flex border-r border-borders bg-background" />

                {/* Sidebar mobile (Overlay) */}
                {mobileMenuOpen && (
                    <div className="fixed inset-0 z-50 md:hidden flex">
                        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
                        <div className="relative w-[280px] h-full bg-background border-r border-borders">
                            <Sidebar className="w-full h-full border-r border-borders" onNavigate={() => setMobileMenuOpen(false)} />
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="flex-1 flex flex-col h-screen overflow-y-auto w-full relative">
                    {/* Mobile Header */}
                    <header className="md:hidden flex items-center justify-between px-3 py-4 sm:p-4 border-b border-borders bg-background sticky top-0 z-40">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-brand-green/20 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-brand-green" />
                            </div>
                            <h1 className="font-heading font-bold text-xl text-white">FinFamily</h1>
                        </div>
                        <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-foreground/70 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                            <Menu className="w-6 h-6" />
                        </button>
                    </header>

                    <main className="flex-1 px-3 py-4 sm:p-6 md:p-8">
                        <SeedManager>
                            <GlobalShortcuts />
                            {children}
                        </SeedManager>
                    </main>
                </div>
            </div>
        </ProtectRoute>
    );
}
