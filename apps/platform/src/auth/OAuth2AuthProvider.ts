import { addSeconds } from 'date-fns'
import { RequestError } from '../core/errors'
import AuthError from './AuthError'
import { AuthTypeConfig } from './Auth'
import AuthProvider, { AuthContext } from './AuthProvider'
import { firstQueryParam } from '../utilities'
import App from '../app'

export interface OAuth2Config extends AuthTypeConfig {
    driver: 'oauth2'
    authorizationUrl: string
    tokenUrl: string
    userinfoUrl: string
    clientId: string
    clientSecret: string
    redirectUri: string
    scopes: string[]
    emailField?: string
}

interface TokenResponse {
    access_token: string
    token_type?: string
    expires_in?: number
    refresh_token?: string
    scope?: string
}

interface UserinfoResponse {
    email: string
    name?: string
    given_name?: string
    family_name?: string
    picture?: string
    [key: string]: any
}

export default class OAuth2AuthProvider extends AuthProvider {

    private config: OAuth2Config

    constructor(config: OAuth2Config) {
        super()
        this.config = config
    }

    async start(ctx: AuthContext): Promise<void> {
        // Generate state for CSRF protection
        const state = this.generateRandomString(32)
        
        ctx.cookies.set('oauth_state', state, {
            secure: ctx.request.secure,
            httpOnly: true,
            expires: addSeconds(Date.now(), 3600),
            signed: true,
        })

        const relayState = firstQueryParam(ctx.request.query.r)
        ctx.cookies.set('relaystate', relayState, {
            secure: ctx.request.secure,
            httpOnly: true,
            expires: addSeconds(Date.now(), 3600),
            signed: true,
        })

        const organization = ctx.state.organization
        if (organization) {
            ctx.cookies.set('organization', `${organization.id}`, {
                secure: ctx.request.secure,
                httpOnly: true,
                expires: addSeconds(Date.now(), 3600),
                signed: true,
            })
        }

        // Build authorization URL
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            state,
            scope: this.config.scopes.join(' '),
        })

        const authUrl = `${this.config.authorizationUrl}?${params.toString()}`
        ctx.redirect(authUrl)
    }

    async validate(ctx: AuthContext): Promise<void> {
        try {
            // Get code and state from callback
            const code = firstQueryParam(ctx.request.query.code) || ctx.request.body?.code
            const returnedState = firstQueryParam(ctx.request.query.state) || ctx.request.body?.state
            const storedState = ctx.cookies.get('oauth_state', { signed: true })
            const relayState = ctx.cookies.get('relaystate', { signed: true })

            // Validate state for CSRF protection
            if (!returnedState || returnedState !== storedState) {
                throw new RequestError(AuthError.InvalidState)
            }

            if (!code) {
                throw new RequestError(AuthError.InvalidCode)
            }

            // Exchange code for access token
            const tokenResponse = await this.exchangeCodeForToken(code)

            // Fetch user info
            const userinfo = await this.fetchUserinfo(tokenResponse.access_token)
            console.log(JSON.stringify(userinfo))
            const emailFromPath = this.config.emailField ? this.getByPath(userinfo as any, this.config.emailField) : undefined
            const email = (userinfo as any).email ?? emailFromPath
            if (!email || typeof email !== 'string' || email.trim() === '') {
                console.error('[OAuth2] Missing email in userinfo', {
                    emailField: this.config.emailField,
                    fields: Object.keys(userinfo),
                })
                throw new RequestError(AuthError.InvalidEmail)
            }

            // Create admin params
            const admin = {
                email,
                first_name: (userinfo as any).given_name || (userinfo as any).name,
                last_name: (userinfo as any).family_name,
                image_url: (userinfo as any).picture,
            }

            await this.login(admin, ctx, relayState)

            // Clear cookies
            ctx.cookies.set('oauth_state', null)
            ctx.cookies.set('relaystate', null)
            ctx.cookies.set('organization', null)

        } catch (error: any) {
            App.main.error.notify(error)
            if (error instanceof RequestError) {
                throw error
            }
            throw new RequestError(AuthError.OAuth2ValidationError)
        }
    }

    private async exchangeCodeForToken(code: string): Promise<TokenResponse> {
        try {
            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.config.redirectUri,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            })

            // Debug logging
            console.log('[OAuth2] Token Exchange Request:', {
                url: this.config.tokenUrl,
                client_id: this.config.clientId,
                has_secret: !!this.config.clientSecret,
                secret_length: this.config.clientSecret?.length || 0,
                redirect_uri: this.config.redirectUri,
            })

            const response = await fetch(this.config.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            })

            if (!response.ok) {
                const errorBody = await response.text()
                console.error('[OAuth2] Token Exchange Failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorBody,
                })
                throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorBody}`)
            }

            const tokenData = await response.json() as TokenResponse
            console.log('[OAuth2] Token Exchange Success:', {
                has_access_token: !!tokenData.access_token,
            })

            return tokenData
        } catch (error: any) {
            App.main.error.notify(error)
            throw new RequestError(AuthError.TokenExchangeFailed)
        }
    }

    private async fetchUserinfo(accessToken: string): Promise<UserinfoResponse> {
        try {
            console.log('[OAuth2] Userinfo Request:', {
                url: this.config.userinfoUrl,
            })

            const response = await fetch(this.config.userinfoUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'X-APP-VERSION': '1.0.0',
                    'X-APP-PLATFORM': 'web',
                },
            })

            if (!response.ok) {
                const errorBody = await response.text()
                console.error('[OAuth2] Userinfo Fetch Failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorBody,
                })
                throw new Error(`Userinfo fetch failed: ${response.status} ${response.statusText} - ${errorBody}`)
            }

            const userinfo = await response.json() as UserinfoResponse
            console.log('[OAuth2] Userinfo Response:', {
                has_email: !!userinfo.email,
                fields: Object.keys(userinfo),
                userinfo,
            })
            try {
                console.log('[OAuth2] Userinfo JSON:', JSON.stringify(userinfo))
            } catch {}

            return userinfo
        } catch (error: any) {
            App.main.error.notify(error)
            throw new RequestError(AuthError.UserinfoFetchFailed)
        }
    }

    private generateRandomString(length: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        let result = ''
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
    }

    private getByPath(obj: any, path: string): any {
        try {
            return path.split('.').reduce((o: any, k: string) => (o != null ? o[k] : undefined), obj)
        } catch {
            return undefined
        }
    }
}
