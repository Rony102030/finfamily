"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Wallet, Eye, EyeOff } from "lucide-react";

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ text: "", type: "" });
    const router = useRouter();

    useEffect(() => {
        // Option to verify if the user has an active session from the recovery link
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // Not authenticated, they might have lost the token or are here by mistake
                // We don't automatically redirect in case they just clicked the link, 
                // but usually the token is parsed automatically by Supabase client in the URL hash
            }
        };
        checkSession();
    }, []);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg({ text: "", type: "" });

        if (password !== confirmPassword) {
            setMsg({ text: "As senhas não coincidem", type: "error" });
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setMsg({ text: "A senha deve ter pelo menos 6 caracteres", type: "error" });
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;
            
            setMsg({ text: "Senha atualizada com sucesso!", type: "success" });
            
            // Redirect after successful update
            setTimeout(() => {
                router.push("/dashboard");
            }, 2000);
            
        } catch (error: any) {
            setMsg({ text: error.message || "Ocorreu um erro ao atualizar a senha", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-background">
            {/* Visual Side */}
            <div className="hidden md:flex flex-1 flex-col justify-center items-center p-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-brand-green/5"></div>
                <div className="z-10 text-center max-w-md">
                    <Wallet className="w-20 h-20 text-brand-green mx-auto mb-8 animate-pulse" />
                    <h1 className="font-heading text-5xl font-bold text-white mb-4">FinFamily</h1>
                    <p className="text-xl text-foreground/80">Gestão Financeira Familiar com inteligência artificial.</p>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-green/20 rounded-full blur-[120px] pointer-events-none"></div>
            </div>

            {/* Form Side */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12 border-l border-borders bg-surface/50 backdrop-blur-sm z-10">
                <div className="w-full max-w-md space-y-8 bg-cards p-8 rounded-2xl border border-borders shadow-xl">
                    <div className="text-center md:hidden mb-8 flex flex-col items-center justify-center">
                        <Wallet className="w-12 h-12 text-brand-green mb-3" />
                        <h1 className="font-heading text-3xl font-bold text-white">FinFamily</h1>
                    </div>

                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-white tracking-tight">Redefinir Senha</h2>
                        <p className="text-foreground/60 text-sm">Crie uma nova senha para sua conta</p>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="space-y-6">
                        {msg.text && (
                            <div className={`p-3 rounded-lg text-sm text-center border ${msg.type === 'success' ? 'bg-brand-green/10 text-brand-green border-brand-green/20' : 'bg-brand-red/10 text-brand-red border-brand-red/20'}`}>
                                {msg.text}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2 relative">
                                <label className="text-sm font-medium text-foreground/80">Nova Senha</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-background border border-borders text-white focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all pr-12"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/60 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="space-y-2 relative">
                                <label className="text-sm font-medium text-foreground/80">Confirmar Nova Senha</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-background border border-borders text-white focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all pr-12"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/60 hover:text-white transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-brand-green text-background font-bold py-3 rounded-xl hover:bg-brand-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                            ) : "Atualizar Senha"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
