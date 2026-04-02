"use client";

import { FundosTab } from "@/app/(dashboard)/configuracoes/tabs/FundosTab";
import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function FundosConfiguracaoPage() {
    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
            <header className="flex items-center gap-3 pb-4 border-b border-borders">
                <Link
                    href="/fundos"
                    className="p-2 text-foreground/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Voltar para Fundos"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="p-2 bg-surface rounded-lg border border-borders">
                    <SlidersHorizontal className="w-5 h-5 text-brand-green" />
                </div>
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white tracking-tight">
                        Configuração de Fundos
                    </h1>
                    <p className="text-sm text-foreground/60">
                        Defina os nomes e valores mensais de cada fundo acumulativo.
                    </p>
                </div>
            </header>

            <div className="bg-cards border border-borders rounded-2xl p-6">
                <FundosTab />
            </div>
        </div>
    );
}
