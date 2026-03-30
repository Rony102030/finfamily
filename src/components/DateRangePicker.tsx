import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onChange: (start: string, end: string) => void;
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectingStart, setSelectingStart] = useState<Date | null>(startDate ? new Date(startDate + 'T12:00:00') : null);
    const [selectingEnd, setSelectingEnd] = useState<Date | null>(endDate ? new Date(endDate + 'T12:00:00') : null);
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Sync from props
    useEffect(() => {
        setSelectingStart(startDate ? new Date(startDate + 'T12:00:00') : null);
        setSelectingEnd(endDate ? new Date(endDate + 'T12:00:00') : null);
    }, [startDate, endDate]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatDateStr = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const handleDayClick = (dayDate: Date) => {
        if (!selectingStart || (selectingStart && selectingEnd)) {
            setSelectingStart(dayDate);
            setSelectingEnd(null);
            onChange(formatDateStr(dayDate), ""); // Let parent know start changed but end cleared
        } else {
            if (dayDate < selectingStart) {
                setSelectingEnd(selectingStart);
                setSelectingStart(dayDate);
                onChange(formatDateStr(dayDate), formatDateStr(selectingStart));
            } else {
                setSelectingEnd(dayDate);
                onChange(formatDateStr(selectingStart), formatDateStr(dayDate));
            }
            setIsOpen(false);
        }
    };

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d, 12, 0, 0);
            const isStart = selectingStart && date.getTime() === selectingStart.getTime();
            const isEnd = selectingEnd && date.getTime() === selectingEnd.getTime();
            
            let isBetween = false;
            if (selectingStart && selectingEnd && date > selectingStart && date < selectingEnd) isBetween = true;
            if (selectingStart && !selectingEnd && hoverDate && hoverDate > selectingStart && date > selectingStart && date <= hoverDate) isBetween = true;
            if (selectingStart && !selectingEnd && hoverDate && hoverDate < selectingStart && date < selectingStart && date >= hoverDate) isBetween = true;

            days.push(
                <button
                    key={d}
                    onClick={() => handleDayClick(date)}
                    onMouseEnter={() => setHoverDate(date)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-colors flex items-center justify-center
                        ${isStart || isEnd ? 'bg-brand-green text-background' : 
                          isBetween ? 'bg-brand-green/20 text-white' : 
                          'text-foreground hover:bg-white/10'}`}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

    const formatDisplay = () => {
        if (!selectingStart && !selectingEnd) return "Selecione um período";
        const formatBr = (d: Date | null) => d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : "";
        if (selectingStart && !selectingEnd) return `${formatBr(selectingStart)} - Selecione o fim`;
        return `${formatBr(selectingStart)} até ${formatBr(selectingEnd)}`;
    };

    return (
        <div className="relative z-50" ref={popoverRef}>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between gap-3 bg-background border border-borders hover:border-brand-green transition-colors rounded-lg px-4 py-2 text-sm text-foreground/80 min-w-[240px]"
                >
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-brand-green" />
                        <span>{formatDisplay()}</span>
                    </div>
                </button>
                {(selectingStart || selectingEnd) && (
                    <button 
                        onClick={() => {
                            setSelectingStart(null);
                            setSelectingEnd(null);
                            onChange("", "");
                        }}
                        className="p-2 text-brand-red bg-brand-red/10 rounded-lg hover:bg-brand-red hover:text-white transition-colors"
                        title="Limpar data"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="absolute top-full mt-2 left-0 bg-surface border border-borders rounded-xl shadow-xl w-[260px] p-4 text-white">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                        <span className="font-bold text-sm capitalize">
                            {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                            <div key={i} className="text-xs font-bold text-foreground/50 w-7 h-7 flex items-center justify-center mx-auto">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1" onMouseLeave={() => setHoverDate(null)}>
                        {renderCalendar()}
                    </div>
                </div>
            )}
        </div>
    );
}
