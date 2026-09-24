"use client";

import { useState } from "react";
import { CarteirasTab } from "./tabs/CarteirasTab";
import { CategoriasTab } from "./tabs/CategoriasTab";
import { FontesTab } from "./tabs/FontesTab";
import { SubcategoriasTab } from "./tabs/SubcategoriasTab";
import Link from "next/link";
import { Settings } from "lucide-react";

type TabType = 'carteiras' | 'categorias' | 'subcategorias' | 'fontes';

const tabs: { id: TabType; label: string }[] = [
    { id: 'carteiras', label: 'Carteiras' },
    { id: 'categorias', label: 'Categorias' },
    { id: 'subcategorias', label: 'Subcategorias' },
    { id: 'fontes', label: 'Fontes de Renda' },
];

export default function ConfiguracoesPage() {
    const [activeTab, setActiveTab] = useState<TabType>('carteiras');

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
            <header className="secao flex items-center gap-3">
                <div className="p-2 bg-surface rounded-lg border border-borders">
                    <Settings className="w-5 h-5 text-brand-green" />
                </div>
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight">
                        Configurações
                    </h1>
                    <p className="text-sm text-foreground/60">
                        Gerencie suas carteiras, categorias e fontes de renda. Nome e foto ficam no <Link href="/perfil" className="text-brand-green hover:underline">seu perfil</Link>.
                    </p>
                </div>
            </header>

            {/* Tabs Menu */}
            <div className="flex gap-2 p-1 bg-surface rounded-2xl overflow-x-auto sem-rolagem">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                            ? "bg-brand-green text-background"
                            : "text-foreground/70 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'carteiras' && <CarteirasTab />}
                {activeTab === 'categorias' && <CategoriasTab />}
                {activeTab === 'subcategorias' && <SubcategoriasTab />}
                {activeTab === 'fontes' && <FontesTab />}
            </div>
        </div>
    );
}
