import { randomUUID } from 'crypto'
import { PageParams } from '../core/searchParams'
import { loadAnalytics } from '../providers/analytics'
import { User } from '../users/User'
import { UserEvent, UserEventParams } from './UserEvent'
import App from '../app'

export const createEvent = async (
    user: User,
    { name, data }: UserEventParams,
    forward = true,
    filter = (data: Record<string, unknown>) => data,
): Promise<UserEvent> => {
    const eventData = {
        name,
        data,
        project_id: user.project_id,
        user_id: user.id,
        uuid: randomUUID(),
        created_at: new Date(),
    }
    await UserEvent.insert(eventData)

    // TODO: Remove, temporary during transition to new event system
    await App.main.db('user_events').insert({
        name,
        data: JSON.stringify(data),
        project_id: user.project_id,
        user_id: user.id,
        created_at: new Date(),
        updated_at: new Date(),
    })

    if (forward) {
        const analytics = await loadAnalytics(user.project_id)
        analytics.track({
            external_id: user.external_id,
            anonymous_id: user.anonymous_id,
            name,
            data: filter(data),
        })
    }

    return UserEvent.fromJson(eventData)
}

export const getUserEvents = async (id: number, params: PageParams, projectId: number) => {
    const searchClause = params.q ? ` AND \`name\` LIKE '%${params.q}%' ` : ''
    return await UserEvent.search(
        `
        SELECT * FROM user_events 
        WHERE project_id = ${projectId}
            AND user_id = ${id}
            ${searchClause}
        ORDER BY created_at DESC
        `,
        params,
    )
}
