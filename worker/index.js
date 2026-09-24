// Código extra do service worker (o next-pwa junta este arquivo ao sw.js no build).
// Recebe as notificações do lembrete semanal e abre o app ao tocar nelas.

self.addEventListener("push", (event) => {
    let dados = {};
    try {
        dados = event.data ? event.data.json() : {};
    } catch {
        dados = { body: event.data ? event.data.text() : "" };
    }
    event.waitUntil(
        self.registration.showNotification(dados.title || "FinFamily", {
            body: dados.body || "",
            icon: "/icon-192.png",
            badge: "/badge-96.png",
            tag: dados.tag || "finfamily-lembrete",
            renotify: true,
            data: { url: dados.url || "/dashboard" },
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || "/dashboard";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
            for (const janela of janelas) {
                if ("focus" in janela) {
                    janela.navigate(url);
                    return janela.focus();
                }
            }
            return self.clients.openWindow(url);
        }),
    );
});
