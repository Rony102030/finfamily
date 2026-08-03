const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function formatMonth(activeMonth: string): string {
    if (!activeMonth) return "";
    const [y, m] = activeMonth.split("-");
    return `${monthNames[parseInt(m) - 1]} ${y}`;
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
