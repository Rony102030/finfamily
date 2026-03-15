"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Wallet, Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLogin, setIsLogin] = useState(true);
    const [isResetMode, setIsResetMode] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ text: "", type: "" });
    const router = useRouter();

    // Check for error messages from Supabase in the URL (e.g., expired token)
    useEffect(() => {
        if (typeof window !== "undefined" && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const errorDescription = hashParams.get("error_description");
            if (errorDescription) {
                // Formatting common Supabase errors to Portuguese
                let errorMessage = decodeURIComponent(errorDescription).replace(/\+/g, " ");
                if (errorMessage.includes("Email link is invalid or has expired")) {
                    errorMessage = "O link de recuperação é inválido ou expirou. Por favor, solicite um novo.";
                    setIsResetMode(true);
                }
                setMsg({ text: errorMessage, type: "error" });
                
                // Limpa o hash da URL para não mostrar o erro novamente num refresh
                window.history.replaceState(null, "", window.location.pathname);
            }
        }
    }, []);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg({ text: "", type: "" });

        try {
            if (isResetMode) {
                // Handle Password Reset
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/update-password`,
                });
                if (error) throw error;
                setMsg({ text: "E-mail de recuperação enviado! Verifique sua caixa de entrada.", type: "success" });
                setIsResetMode(false);
                setIsLogin(true);
            } else if (isLogin) {
                // Handle Login
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                router.push("/dashboard");
            } else {
                // Handle Signup
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/dashboard`
                    }
                });
                if (error) throw error;
                router.push("/dashboard");
            }
        } catch (error: any) {
            setMsg({ text: error.message || "Ocorreu um erro", type: "error" });
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
                {/* Glow effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-green/20 rounded-full blur-[120px] pointer-events-none"></div>
            </div>

            {/* Form Side */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12 border-l border-borders bg-surface/50 backdrop-blur-sm z-10">
                <div className="w-full max-w-md space-y-8 bg-cards p-8 rounded-2xl border border-borders shadow-xl relative">
                    {isResetMode && (
                        <button
                            onClick={() => {
                                setIsResetMode(false);
                                setMsg({ text: "", type: "" });
                            }}
                            className="absolute top-6 left-6 text-foreground/60 hover:text-white transition-colors"
                            title="Voltar"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}

                    <div className="text-center md:hidden mb-8 flex flex-col items-center justify-center pt-4">
                        <Wallet className="w-12 h-12 text-brand-green mb-3" />
                        <h1 className="font-heading text-3xl font-bold text-white">FinFamily</h1>
                    </div>

                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-white tracking-tight">
                            {isResetMode ? "Recuperar Senha" : isLogin ? "Bem-vindo de volta" : "Criar nova conta"}
                        </h2>
                        <p className="text-foreground/60 text-sm">
                            {isResetMode 
                                ? "Digite seu e-mail para receber um link de recuperação"
                                : isLogin 
                                    ? "Entre com suas credenciais para acessar" 
                                    : "Preencha os dados para começar"
                            }
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-6">
                        {msg.text && (
                            <div className={`p-3 rounded-lg text-sm text-center border ${msg.type === 'success' ? 'bg-brand-green/10 text-brand-green border-brand-green/20' : 'bg-brand-red/10 text-brand-red border-brand-red/20'}`}>
                                {msg.text}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground/80">E-mail</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-borders text-white focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent transition-all"
                                    placeholder="seu@email.com"
                                />
                            </div>
                            
                            {!isResetMode && (
                                <div className="space-y-2 relative">
                                    <label className="text-sm font-medium text-foreground/80">Senha</label>
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
                                    {isLogin && (
                                        <div className="flex justify-end pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsResetMode(true);
                                                    setMsg({ text: "", type: "" });
                                                }}
                                                className="text-xs text-brand-green hover:underline cursor-pointer"
                                            >
                                                Esqueceu a senha?
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-brand-green text-background font-bold py-3 rounded-xl hover:bg-brand-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                            ) : isResetMode ? "Enviar link de recuperação" : isLogin ? "Entrar" : "Cadastrar"}
                        </button>
                    </form>

                    {!isResetMode && (
                        <div className="text-center pt-4 border-t border-borders">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setMsg({ text: "", type: "" });
                                }}
                                className="text-sm text-brand-green hover:underline cursor-pointer"
                            >
                                {isLogin ? "Não tem uma conta? Cadastre-se" : "Já tem uma conta? Entre"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
