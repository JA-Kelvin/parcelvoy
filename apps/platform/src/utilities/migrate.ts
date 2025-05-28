import { randomUUID } from 'crypto'
import { Chunker } from '.'
import App from '../app'
import List from '../lists/List'
import { staticListRule } from '../lists/ListService'
import { fetchAndCompileRule } from '../rules/RuleService'
import { User } from '../users/User'
import { UserEvent } from '../users/UserEvent'
import { logger } from '../config/logger'
import { cacheDel, cacheGet } from '../config/redis'

export const migrateToClickhouse = async () => {
    await migrateUsers()
    await migrateEvents()
    await migrateLists()
}

const migrateUsers = async () => {
    const migrate = await cacheGet<boolean>(App.main.redis, 'migration:users') ?? false
    if (!migrate) return
    logger.info('parcelvoy:migration users start')
    const users = await User.query().stream()

    const size = 500
    const chunker = new Chunker<User>(async users => {
        await User.clickhouse().insert(users.map(user => ({ ...user, sign: 1 })))
    }, size)

    for await (const user of users) {
        await chunker.add(user)
    }

    await chunker.flush()
    logger.info('parcelvoy:migration users finished')
    await cacheDel(App.main.redis, 'migration:users')
}

const migrateEvents = async () => {
    const migrate = await cacheGet<boolean>(App.main.redis, 'migration:events') ?? false
    if (!migrate) return
    logger.info('parcelvoy:migration events start')
    const events = await App.main.db('user_events').stream()

    const size = 500
    const chunker = new Chunker<UserEvent>(async events => {
        await UserEvent.insert(events.map(event => ({ ...event, uuid: randomUUID() })))
    }, size)

    for await (const event of events) {
        await chunker.add(event)
    }

    await chunker.flush()
    logger.info('parcelvoy:migration events finished')
    await cacheDel(App.main.redis, 'migration:events')
}

const migrateStaticList = async ({ id, project_id }: List) => {
    const users = await App.main.db('user_list').where('list_id', id).stream()

    const size = 500
    const chunker = new Chunker<{ user_id: number, list_id: number, created_at: number, version: number }>(async users => {
        await UserEvent.insert(
            users.map(user => ({
                name: 'user_imported_to_list',
                user_id: user.user_id,
                project_id,
                data: {
                    list_id: user.list_id,
                    version: user.version,
                },
                uuid: randomUUID(),
                created_at: new Date(user.created_at),
            })),
        )
    }, size)

    for await (const user of users) {
        await chunker.add(user)
    }

    await chunker.flush()
}

const migrateLists = async () => {
    const migrate = await cacheGet<boolean>(App.main.redis, 'migration:lists') ?? false
    if (!migrate) return
    logger.info('parcelvoy:migration lists start')
    const lists = await List.all(qb => qb.whereNull('deleted_at'))
    for (const list of lists) {
        const rule = list.type === 'dynamic' && list.rule_id
            ? await fetchAndCompileRule(list.rule_id)
            : staticListRule(list)
        await List.update(qb => qb.where('id', list.id), {
            rule,
        })

        if (list.type === 'static') {
            await migrateStaticList(list)
        }
    }

    logger.info('parcelvoy:migration lists finished')
    await cacheDel(App.main.redis, 'migration:lists')
}
