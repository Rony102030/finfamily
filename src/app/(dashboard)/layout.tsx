"use client";

import { ProtectRoute } from "@/components/ProtectRoute";
import { Sidebar } from "@/components/Sidebar";
import { SeedManager } from "@/components/SeedManager";
import { GlobalShortcuts } from "@/components/GlobalShortcuts";
import { Wallet, Menu } from "lucide-react";
import { useState } from "react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <ProtectRoute>
            <div className="flex h-screen overflow-hidden bg-background">
                {/* Sidebar desktop */}
                <Sidebar className="w-[230px] flex-shrink-0 hidden md:flex border-r border-borders bg-surface" />

                {/* Sidebar mobile (Overlay) */}
                {mobileMenuOpen && (
                    <div className="fixed inset-0 z-50 md:hidden flex">
                        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
                        <div className="relative w-[280px] h-full bg-surface shadow-2xl">
                            <Sidebar className="w-full h-full border-r border-borders" />
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="flex-1 flex flex-col h-screen overflow-y-auto w-full relative">
                    {/* Mobile Header */}
                    <header className="md:hidden flex items-center justify-between p-4 border-b border-borders bg-surface/50 backdrop-blur-md sticky top-0 z-40">
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

                    <main className="flex-1 p-6 md:p-8">
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
