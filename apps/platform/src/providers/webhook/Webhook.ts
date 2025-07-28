export interface Webhook {
    method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
    endpoint: string
    headers: Record<string, string>
    body?: Record<string, any>
    cacheKey?: string
}

export interface WebhookResponse {
    request: Webhook
    success: boolean
    response: Record<string, any> | string
}
