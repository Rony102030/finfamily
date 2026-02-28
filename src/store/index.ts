import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserConfig {
    pct_fixo: number;
    pct_emergencia: number;
    pct_outro: number;
    outro_nome: string | null;
    seed_done: boolean;
}

interface AppState {
    activeMonth: string; // "YYYY-MM"
    userConfig: UserConfig | null;
    anthropicKey: string | null;
    setActiveMonth: (month: string) => void;
    setUserConfig: (config: UserConfig) => void;
    setAnthropicKey: (key: string) => void;
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
            setActiveMonth: (activeMonth) => set({ activeMonth }),
            setUserConfig: (userConfig) => set({ userConfig }),
            setAnthropicKey: (anthropicKey) => set({ anthropicKey }),
        }),
        {
            name: 'finfamily-storage',
            // We only want to persist anthropicKey. The activeMonth can reset on reload, or we can persist it. Let's persist activeMonth and anthropicKey.
            partialize: (state) => ({
                anthropicKey: state.anthropicKey,
                activeMonth: state.activeMonth
            }),
        }
    )
);
