import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface MultiSelectProps {
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder: string;
}

export function MultiSelect({ options, selected, onChange, placeholder }: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(i => i !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    const clearAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
    };

    const displayValue = selected.length === 0 
        ? placeholder 
        : selected.length === 1 
            ? selected[0] 
            : `${selected.length} selecionadas`;

    return (
        <div className="relative flex-1 w-full min-w-[200px] max-w-full md:max-w-xs" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 bg-background border border-borders rounded-xl px-4 py-2.5 text-white/90 hover:text-white focus:outline-none focus:border-brand-green transition-all shadow-sm"
            >
                <div className="flex flex-col items-start overflow-hidden">
                    <span className="text-[10px] uppercase font-bold text-foreground/50 leading-none mb-1">{placeholder}</span>
                    <span className="text-sm truncate font-medium max-w-full leading-none">{displayValue}</span>
                </div>
                <div className="flex items-center gap-2">
                    {selected.length > 0 && (
                        <div 
                            onClick={clearAll}
                            className="bg-brand-red/20 text-brand-red text-[10px] px-1.5 py-0.5 rounded font-bold hover:bg-brand-red/30 transition-colors"
                        >
                            X
                        </div>
                    )}
                    <ChevronDown className={`w-4 h-4 text-foreground/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>
            
            {isOpen && (
                <div className="absolute top-full mt-2 left-0 w-full bg-surface border border-borders rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-2 slide-in-from-top-2 animate-in duration-200">
                    {options.length === 0 ? (
                        <div className="px-4 py-2 text-sm text-foreground/50 text-center">Nenhuma opção disponível</div>
                    ) : (
                        <div className="px-2 mb-2 pb-2 border-b border-borders/50">
                            <button
                                onClick={() => onChange(selected.length === options.length ? [] : [...options])}
                                className="w-full text-left px-2 py-1.5 text-xs font-bold text-brand-green bg-brand-green/10 hover:bg-brand-green/20 transition-colors rounded-lg"
                            >
                                {selected.length === options.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                            </button>
                        </div>
                    )}
                    {options.map(option => (
                        <label 
                            key={option} 
                            className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 cursor-pointer transition-colors"
                        >
                            <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={selected.includes(option)}
                                onChange={() => toggleOption(option)}
                            />
                            <div className={`w-4 h-4 rounded border flex flex-shrink-0 items-center justify-center transition-all duration-200
                                ${selected.includes(option) ? 'bg-brand-green border-brand-green text-[#0f131a]' : 'border-borders bg-background'}
                            `}>
                                {selected.includes(option) && <Check className="w-3 h-3 font-bold" />}
                            </div>
                            <span className={`text-sm truncate transition-colors ${selected.includes(option) ? 'text-white font-medium' : 'text-foreground/80'}`}>
                                {option}
                            </span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}
