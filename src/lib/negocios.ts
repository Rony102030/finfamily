"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Modulo = 'frango' | 'servico_extra';

// Um pedido por usuário, compartilhado entre o menu (desktop e mobile) e as páginas.
const cache = new Map<string, Promise<Set<string>>>();

function buscarModulos(userId: string) {
    if (!cache.has(userId)) {
        cache.set(userId, (async () => {
            const { data, error } = await supabase.from('negocios_acesso').select('modulo').eq('user_id', userId);
            if (error) {
                cache.delete(userId);
                return new Set<string>();
            }
            return new Set((data || []).map(r => r.modulo as string));
        })());
    }
    return cache.get(userId)!;
}

/** Módulos de Negócios liberados para o usuário. `null` enquanto carrega. */
export function useNegociosAcesso(userId: string | undefined) {
    const [modulos, setModulos] = useState<Set<string> | null>(null);
    useEffect(() => {
        if (!userId) return;
        let vivo = true;
        buscarModulos(userId).then(m => { if (vivo) setModulos(m); });
        return () => { vivo = false; };
    }, [userId]);
    return modulos;
}
