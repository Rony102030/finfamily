"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { useAppStore } from "@/store";

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function AntiGravityPage() {
    const { anthropicKey } = useAppStore();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Olá! Sou o **FinFamily IA**, seu consultor financeiro pessoal. Como posso ajudar com suas finanças hoje?' }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        if (!anthropicKey) {
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '⚠️ **Chave de API não configurada**.\n\nPara conversar comigo, por favor vá até as Configurações (Aba IA) e insira sua chave da Anthropic (Claude).'
                }]);
                setLoading(false);
            }, 800);
            return;
        }

        try {
            // format messages for Anthropic
            const anthropicMsgs = messages.filter(m => m.role !== 'assistant' || !m.content.includes('⚠️')).concat(userMsg).map(m => ({
                role: m.role,
                content: m.content
            }));

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: anthropicMsgs, apiKey: anthropicKey })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
        } catch (err: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${err.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    const suggestions = [
        "Como divirto minha renda no padrão 50/30/20?",
        "Qual a melhor forma de quitar dívidas de cartão?",
        "O que é reserva de emergência e quanto preciso ter?"
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-[120px])] animate-in fade-in duration-500 max-w-4xl mx-auto">
            <header className="pb-4 border-b border-borders flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-purple/20 border border-brand-purple/30 rounded-xl flex items-center justify-center">
                        <Sparkles className="text-brand-purple w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-heading font-bold text-white tracking-tight">FinFamily IA</h1>
                        <p className="text-xs text-brand-purple font-semibold animate-pulse">Online e pronto para ajudar</p>
                    </div>
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar py-6 space-y-6">
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-surface border border-borders text-foreground/70' : 'bg-brand-purple/20 text-brand-purple border border-brand-purple/30 shadow-[0_0_15px_rgba(181,123,255,0.2)]'}`}>
                            {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                        </div>
                        <div className={`max-w-[75%] rounded-2xl p-4 ${m.role === 'user' ? 'bg-surface border border-borders text-white' : 'bg-brand-purple/10 border border-brand-purple/20 text-white/90'}`}>
                            {m.content.split('\n').map((line, j) => (
                                <p key={j} className="mb-2 last:mb-0 leading-relaxed">
                                    {/* Simple bold parsing */}
                                    {line.split(/(\*\*.*?\*\*)/).map((part, k) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                            return <strong key={k} className="font-bold text-white">{part.slice(2, -2)}</strong>;
                                        }
                                        return part;
                                    })}
                                </p>
                            ))}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-brand-purple/20 text-brand-purple border border-brand-purple/30 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="bg-brand-purple/10 border border-brand-purple/20 rounded-2xl p-4 flex items-center gap-2 text-brand-purple">
                            <div className="w-2 h-2 rounded-full bg-brand-purple animate-bounce"></div>
                            <div className="w-2 h-2 rounded-full bg-brand-purple animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 rounded-full bg-brand-purple animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 pt-4">
                {messages.length === 1 && (
                    <div className="flex flex-wrap gap-2 mb-4 justify-center">
                        {suggestions.map((s) => (
                            <button
                                key={s}
                                onClick={() => { setInput(s); handleSend(); }}
                                className="bg-surface hover:bg-white/5 border border-borders text-xs text-foreground/70 rounded-full px-4 py-2 transition-colors"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}
                <form onSubmit={handleSend} className="relative flex items-center">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Pergunte ao FinFamily IA..."
                        disabled={loading}
                        className="w-full bg-cards border border-borders rounded-xl pl-6 pr-16 py-4 text-white focus:outline-none focus:border-brand-purple transition-all shadow-lg"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="absolute right-3 bg-brand-purple text-white p-2.5 rounded-lg hover:bg-brand-purple/90 disabled:opacity-50 transition-colors"
                    >
                        <Send className="w-5 h-5 ml-0.5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
