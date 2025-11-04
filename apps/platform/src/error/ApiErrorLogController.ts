import Router from '@koa/router'
import { JSONSchemaType } from 'ajv'
import { ProjectState } from '../auth/AuthMiddleware'
import { projectRoleMiddleware } from '../projects/ProjectService'
import { extractQueryParams } from '../utilities'
import { SearchSchema } from '../core/searchParams'
import ApiErrorLog from './ApiErrorLog'

const router = new Router<ProjectState>({ prefix: '/error-logs' })

router.use(projectRoleMiddleware('editor'))

const searchSchema = SearchSchema('apiErrorLogSearch', {
    sort: 'id',
    direction: 'desc',
})

router.get('/', async ctx => {
    const params = extractQueryParams(ctx.query, searchSchema)
    const filter = params.filter || {}

    ctx.body = await ApiErrorLog.search(
        { ...params, fields: ['message', 'path', 'code', 'method', 'request_id'] },
        qb => qb
            .where('project_id', ctx.state.project.id)
            .when(!!filter.status, q => q.where('status', filter.status))
            .when(!!filter.code, q => q.where('code', filter.code))
            .when(!!filter.method, q => q.where('method', filter.method))
            .when(!!filter.path, q => q.where('path', 'like', `%${filter.path}%`))
            .when(!!filter.from, q => q.where('created_at', '>=', new Date(filter.from)))
            .when(!!filter.to, q => q.where('created_at', '<=', new Date(filter.to))),
    )
})

const exportSchema: JSONSchemaType<{ format?: 'csv' | 'ndjson'; filter?: Record<string, any> }> = {
    $id: 'apiErrorLogExport',
    type: 'object',
    required: [],
    properties: {
        format: { type: 'string', enum: ['csv', 'ndjson'], nullable: true },
        filter: { type: 'object', nullable: true },
    },
}

router.get('/export', async ctx => {
    const { format = 'ndjson', filter = {} } = extractQueryParams(ctx.query, exportSchema)

    const qb = ApiErrorLog.build(q => q
        .where('project_id', ctx.state.project.id)
        .when(!!filter.status, q => q.where('status', filter.status))
        .when(!!filter.code, q => q.where('code', filter.code))
        .when(!!filter.method, q => q.where('method', filter.method))
        .when(!!filter.path, q => q.where('path', 'like', `%${filter.path}%`))
        .when(!!filter.from, q => q.where('created_at', '>=', new Date(filter.from)))
        .when(!!filter.to, q => q.where('created_at', '<=', new Date(filter.to)))
        .orderBy('id', 'desc'))

    const filename = `error_logs_${ctx.state.project.id}_${Date.now()}.${format === 'csv' ? 'csv' : 'ndjson'}`
    ctx.set('Content-Disposition', `attachment; filename="${filename}"`)

    if (format === 'csv') {
        ctx.type = 'text/csv'
        const rows: any[] = await qb
        const header = ['id','created_at','status','code','method','path','message','request_id'].join(',')
        const lines = [header, ...rows.map((r: any) => [
            r.id,
            r.created_at?.toISOString?.() || r.created_at,
            r.status,
            r.code ?? '',
            r.method,
            r.path,
            JSON.stringify((r.message || '')).replaceAll('"', '""'),
            r.request_id ?? '',
        ].join(','))]
        ctx.body = lines.join('\n')
    } else {
        ctx.type = 'application/x-ndjson'
        const rows: any[] = await qb
        ctx.body = rows.map((r: any) => JSON.stringify(r)).join('\n')
    }
})

const pruneSchema: JSONSchemaType<{ before?: string; days?: number; dryRun?: boolean; filter?: Record<string, any> }> = {
    $id: 'apiErrorLogPrune',
    type: 'object',
    required: [],
    properties: {
        before: { type: 'string', nullable: true },
        days: { type: 'integer', nullable: true },
        dryRun: { type: 'boolean', nullable: true },
        filter: { type: 'object', nullable: true },
    },
}

router.delete('/', projectRoleMiddleware('admin'), async ctx => {
    const { before, days, dryRun, filter = {} } = extractQueryParams(ctx.request.query, pruneSchema)

    let cutoff: Date | undefined
    if (before) cutoff = new Date(before)
    if (!cutoff && typeof days === 'number') {
        cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }
    if (!cutoff) {
        ctx.status = 400
        ctx.body = { error: 'either before (ISO) or days (int) is required' }
        return
    }

    const qb = ApiErrorLog.table()
        .where('project_id', ctx.state.project.id)
        .andWhere('created_at', '<', cutoff!)
        .when(!!filter.status, q => q.where('status', filter.status))
        .when(!!filter.code, q => q.where('code', filter.code))
        .when(!!filter.method, q => q.where('method', filter.method))
        .when(!!filter.path, q => q.where('path', 'like', `%${filter.path}%`))

    if (dryRun) {
        const count = await qb.clone().count({ c: '*' }).then(r => Number((r as any)[0].c || 0))
        ctx.body = { count }
        return
    }

    const deleted = await qb.delete()
    ctx.body = { deleted }
})

export default router
