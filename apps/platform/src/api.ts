import Koa from 'koa'
import koaBody from 'koa-body'
import cors from '@koa/cors'
import serve from 'koa-static'
import controllers, { SubRouter, register } from './config/controllers'
import { RequestError } from './core/errors'
import { logger } from './config/logger'
import Router from '@koa/router'
import ApiErrorLog from './error/ApiErrorLog'

export default class Api extends Koa {
    router = new Router()
    controllers?: Record<string, SubRouter>

    constructor(
        public app: import('./app').default,
    ) {
        super()

        this.proxy = process.env.NODE_ENV !== 'development'

        app.error.attach(this)
        this.use(async (ctx, next) => {
            try {
                await next()
            } catch (error: any) {

                logger.error({ error, ctx }, 'error')
                if (error instanceof RequestError) {
                    ctx.status = error.statusCode ?? 400
                    try {
                        const userId = (ctx.state as any)?.user?.id
                        const projectId = (ctx.state as any)?.project?.id ?? (ctx.params?.project && !isNaN(parseInt(ctx.params.project as any, 10)) ? parseInt(ctx.params.project as any, 10) : undefined)
                        await ApiErrorLog.insert({
                            request_id: ctx.get('X-Request-ID') || undefined,
                            method: ctx.method,
                            path: ctx.path,
                            status: ctx.status,
                            code: (error as any)?.code,
                            message: error.message ?? String(error),
                            stack: error.stack,
                            user_id: userId,
                            project_id: projectId,
                            context: { ip: ctx.ip, ua: ctx.get('user-agent'), host: ctx.host },
                        })
                    } catch {}
                    ctx.body = error
                    return
                } else if (error.status === 404) {
                    return
                } else {
                    ctx.status = 400
                    ctx.body = process.env.NODE_ENV === 'production'
                        ? {
                            status: 'error',
                            error: 'An error occurred with this request.',
                        }
                        : {
                            status: 'error',
                            error: {
                                message: error.message,
                                stack: error.stack,
                            },
                        }
                    try {
                        const userId = (ctx.state as any)?.user?.id
                        const projectId = (ctx.state as any)?.project?.id ?? (ctx.params?.project && !isNaN(parseInt(ctx.params.project as any, 10)) ? parseInt(ctx.params.project as any, 10) : undefined)
                        await ApiErrorLog.insert({
                            request_id: ctx.get('X-Request-ID') || undefined,
                            method: ctx.method,
                            path: ctx.path,
                            status: ctx.status,
                            code: (error as any)?.code,
                            message: error.message ?? String(error),
                            stack: error.stack,
                            user_id: userId,
                            project_id: projectId,
                            context: { ip: ctx.ip, ua: ctx.get('user-agent'), host: ctx.host },
                        })
                    } catch {}
                }

                ctx.app.emit('error', error, ctx)
            }
        })

        this.keys = [app.env.secret]
        this.use(koaBody())
            .use(cors())
            .use(serve('./public', {
                hidden: true,
                defer: !app.env.config.monoDocker,
            }))

        this.registerControllers()
    }

    getControllers() {
        return controllers(this.app)
    }

    registerControllers() {
        this.controllers = this.getControllers()
        this.register(...Object.values(this.controllers))
    }

    register(...routers: SubRouter[]) {
        const apiRouter = new Router({ prefix: '/api' })
        for (const router of routers.filter(r => !r.global)) {
            register(apiRouter, router)
        }
        register(this.router, apiRouter)
        for (const router of routers.filter(r => r.global)) {
            register(this.router, router)
        }
        this.use(this.router.routes())
            .use(this.router.allowedMethods())
    }
}
