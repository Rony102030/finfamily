import { Lock } from "lucide-react";

export function NegocioBloqueado() {
    return (
        <div className="max-w-lg mx-auto mt-10 bg-cards border border-borders rounded-2xl p-5 sm:p-8 text-center space-y-3 animate-in fade-in duration-500">
            <div className="w-14 h-14 rounded-full bg-brand-yellow/10 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7 text-brand-yellow" />
            </div>
            <h1 className="font-heading font-bold text-xl text-white">Negócios</h1>
            <p className="text-sm text-foreground/70">
                Área para controlar o caixa da sua empresa, liberada sob pedido.
                Fale com o Rony para liberar na sua conta.
            </p>
        </div>
    );
}
