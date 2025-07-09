import IORedis, { Redis } from 'ioredis'

export interface RedisConfig {
    host: string
    port: number
    username?: string
    password?: string
    tls: boolean
}

export const DefaultRedis = ({ port, host, username, password, tls }: RedisConfig, extraOptions = {}): Redis => {
    return new IORedis({
        port,
        host,
        ...username && { username },
        ...password && { password },
        tls: tls
            ? { rejectUnauthorized: false }
            : undefined,
        ...extraOptions,
    })
}

export const cacheGet = async <T>(redis: Redis, key: string): Promise<T | undefined> => {
    const value = await redis.get(key)
    if (!value) return undefined
    return JSON.parse(value) as T
}

export const cacheSet = async <T>(redis: Redis, key: string, value: T, ttl?: number) => {
    await redis.set(key, JSON.stringify(value))
    if (ttl) {
        await redis.expire(key, ttl)
    }
}

export const cacheDel = async (redis: Redis, key: string) => {
    return await redis.del(key)
}

export const cacheIncr = async (redis: Redis, key: string, incr = 1, ttl?: number) => {
    const val = await redis.incrby(key, incr)
    if (ttl) {
        await redis.expire(key, ttl)
    }
    return val
}

export const cacheDecr = async (redis: Redis, key: string, ttl?: number) => {
    const val = await redis.decr(key)
    if (ttl) {
        await redis.expire(key, ttl)
    }
    return val
}

export type DataPair = {
  key: string
  value: string
}
export const cacheBatchHash = async (
    redis: Redis,
    hashKey: string,
    pairs: DataPair[]
): Promise<void> => {
    const pipeline = redis.pipeline()

    const fieldsAndValues: string[] = []
    for (const { key, value } of pairs) {
        fieldsAndValues.push(key, value)
    }

    pipeline.hset(hashKey, ...fieldsAndValues)
    pipeline.expire(hashKey, 60 * 60 * 24) // Set TTL to 24 hours

    await pipeline.exec()
}

export type HashScanCallback = (pairs: DataPair[]) => Promise<void> | void
export const cacheBatchReadHashAndDelete = async (
    redis: Redis,
    hashKey: string,
    callback: HashScanCallback,
    scanCount = 1000
): Promise<void> => {
    let cursor = "0"

    do {
        const [nextCursor, result] = await redis.hscan(hashKey, cursor, "COUNT", scanCount)
        cursor = nextCursor

        const pairs: DataPair[] = [];
        for (let i = 0; i < result.length; i += 2) {
            pairs.push({
                key: result[i],
                value: result[i + 1],
            })
        }

        if (pairs.length > 0) {
            const pipeline = redis.pipeline()

            await callback(pairs)
            for (const pair of pairs) {
                pipeline.hdel(hashKey, pair.key)
            }

            await pipeline.exec()
        }
    } while (cursor !== "0")

    await redis.del(hashKey)
}

export const cacheHashExists = async (redis: Redis, hashKey: string): Promise<boolean> => {
    const exists = await redis.exists(hashKey)
    return exists !== 0
}

export { Redis }
