import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DashboardCardLayout {
    id: string;
    colSpan: number;
}

export interface UserConfig {
    pct_fixo: number;
    pct_emergencia: number;
    pct_outro: number;
    pct_fundo4: number;
    pct_fundo5: number;
    fixo_nome: string | null;
    emergencia_nome: string | null;
    outro_nome: string | null;
    fundo4_nome: string | null;
    fundo5_nome: string | null;
    servico_extra_nome: string | null;
    seed_done: boolean;
}

interface AppState {
    activeMonth: string; // "YYYY-MM"
    userConfig: UserConfig | null;
    anthropicKey: string | null;
    dashboardLayout: DashboardCardLayout[] | null;
    setActiveMonth: (month: string) => void;
    setUserConfig: (config: UserConfig) => void;
    setAnthropicKey: (key: string) => void;
    setDashboardLayout: (layout: DashboardCardLayout[]) => void;
}

const getCurrentMonthStr = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            activeMonth: getCurrentMonthStr(),
            userConfig: null,
            anthropicKey: null,
            dashboardLayout: null,
            setActiveMonth: (activeMonth) => set({ activeMonth }),
            setUserConfig: (userConfig) => set({ userConfig }),
            setAnthropicKey: (anthropicKey) => set({ anthropicKey }),
            setDashboardLayout: (dashboardLayout) => set({ dashboardLayout }),
        }),
        {
            name: 'finfamily-storage',
            partialize: (state) => ({
                anthropicKey: state.anthropicKey,
                activeMonth: state.activeMonth,
                dashboardLayout: state.dashboardLayout,
            }),
        }
    )
);
