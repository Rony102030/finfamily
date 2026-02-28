import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { Save, User as UserIcon } from "lucide-react";

export function PerfilTab() {
    const { user } = useAuth();
    const [name, setName] = useState("");
    const [status, setStatus] = useState("");

    useEffect(() => {
        if (user) {
            setName(user.user_metadata?.display_name || "");
        }
    }, [user]);

    const handleSave = async () => {
        setStatus("Salvando...");
        const { data, error } = await supabase.auth.updateUser({
            data: { display_name: name }
        });

        if (error) {
            setStatus("Erro ao salvar.");
            console.error(error);
        } else {
            setStatus("Perfil atualizado com sucesso! (Recarregue a página se necessário)");
        }
    };

    return (
        <div className="animate-in fade-in max-w-lg">
            <header className="mb-6">
                <h2 className="text-lg font-heading font-bold text-white mb-1 flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-brand-green" /> Seu Perfil
                </h2>
                <p className="text-sm text-foreground/60">
                    Edite as informações do seu perfil.
                </p>
            </header>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-foreground/80 mb-2">Nome de Exibição</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Como deseja ser chamado?"
                        className="w-full bg-surface border border-borders rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green transition-colors"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-foreground/80 mb-2">E-mail</label>
                    <input
                        type="email"
                        value={user?.email || ""}
                        disabled
                        className="w-full bg-surface/50 border border-borders rounded-xl px-4 py-3 text-white/50 cursor-not-allowed"
                    />
                </div>

                <div className="pt-4 flex items-center gap-4">
                    <button
                        onClick={handleSave}
                        className="bg-brand-green text-[#0f131a] px-5 py-2.5 rounded-xl font-bold hover:bg-brand-green/90 transition-all flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" /> Salvar Perfil
                    </button>
                    {status && <span className="text-sm text-brand-green font-medium">{status}</span>}
                </div>
            </div>
        </div>
    );
}
