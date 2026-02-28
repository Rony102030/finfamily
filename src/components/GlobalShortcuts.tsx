"use client";

import { useState, useEffect } from "react";
import { TransactionModal } from "./TransactionModal";

export function GlobalShortcuts() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input or textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                return;
            }

            if (e.key.toLowerCase() === 'n') {
                e.preventDefault();
                setIsModalOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <TransactionModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
        />
    );
}
