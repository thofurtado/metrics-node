import webpush from 'web-push'

export const VAPID_PUBLIC_KEY = 'BGQradO0xULQAgILyiblpRWIplGvISWCmwpeOEDmxQVicz3fg78eqkFRw-TknarkuLhLYiBq9RyL-94CPYpfb-k'
export const VAPID_PRIVATE_KEY = '4bk0icQCzTprKir40B9EgHxH8cYD923K5ZbhPcyCnuE'

webpush.setVapidDetails(
    'mailto:contato@metrics.dev.br',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
)

// Guarda inscrições de push ativas indexadas por order_id / client_phone
class WebPushManager {
    private subscriptions = new Map<string, webpush.PushSubscription>()

    public registerSubscription(orderId: string, subscription: webpush.PushSubscription) {
        this.subscriptions.set(orderId, subscription)
        console.log('[WebPush] Inscrição registrada com sucesso para o pedido:', orderId)
    }

    public async sendPush(orderId: string, payload: { title: string; body: string; url?: string }) {
        const sub = this.subscriptions.get(orderId)
        if (!sub) {
            console.log('[WebPush] Nenhuma inscrição encontrada para o pedido:', orderId)
            return false
        }

        try {
            await webpush.sendNotification(
                sub,
                JSON.stringify({
                    title: payload.title,
                    body: payload.body,
                    url: payload.url || '/cardapio',
                    order_id: orderId
                }),
                {
                    TTL: 60 * 60 * 24 // 24 horas de validade no servidor do Google FCM
                }
            )
            console.log('[WebPush] Notificação enviada com sucesso para o Google FCM (Pedido:', orderId, ')')
            return true
        } catch (error: any) {
            console.error('[WebPush] Erro ao enviar push para o FCM:', error?.message || error)
            if (error.statusCode === 404 || error.statusCode === 410) {
                // Inscrição expirada ou cancelada
                this.subscriptions.delete(orderId)
            }
            return false
        }
    }

    public async notifyOrderStatus(
        orderId: string,
        displayId: number,
        status: string,
        customUrl?: string,
        customTitle?: string,
        customBody?: string
    ) {
        let title = customTitle || ''
        let body = customBody || ''

        if (!title) {
            if (status === 'in_preparation') {
                title = `👨‍🍳 Pedido #${displayId} Confirmado!`
                body = 'O restaurante aceitou seu pedido e já está preparando tudo com carinho!'
            } else if (status === 'dispatched') {
                title = `🛵 Pedido #${displayId} a Caminho!`
                body = 'O motoboy acabou de sair com o seu pedido. Prepare-se para receber!'
            } else if (status === 'delivered') {
                title = `🎉 Pedido #${displayId} Entregue!`
                body = 'Seu pedido foi entregue. Tenha um excelente apetite!'
            } else if (status === 'cancelled') {
                title = `❌ Pedido #${displayId} Cancelado`
                body = 'O pedido foi cancelado pelo restaurante.'
            } else {
                return
            }
        }

        return this.sendPush(orderId, { title, body, url: customUrl || '/cardapio' })
    }
}

export const webPushManager = new WebPushManager()
