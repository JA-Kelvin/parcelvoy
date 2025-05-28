/* eslint-disable @typescript-eslint/no-var-requires */
const clickhouse = require('@clickhouse/client')
const Redis = require('ioredis')

exports.up = async function() {

    const isTest = process.env.NODE_ENV === 'test'

    let client = clickhouse.createClient({
        url: process.env.CLICKHOUSE_URL,
        username: process.env.CLICKHOUSE_USERNAME,
        password: process.env.CLICKHOUSE_PASSWORD,
    })
    const redis = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT || 6379,
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true'
            ? { rejectUnauthorized: false }
            : undefined,
    })

    if (process.env.CLICKHOUSE_DATABASE) {
        await client.command({
            query: 'CREATE DATABASE IF NOT EXISTS ' + process.env.CLICKHOUSE_DATABASE,
        })
        client = clickhouse.createClient({
            url: process.env.CLICKHOUSE_URL,
            username: process.env.CLICKHOUSE_USERNAME,
            password: process.env.CLICKHOUSE_PASSWORD,
            database: process.env.CLICKHOUSE_DATABASE,
        })
    }

    // Enable JSON type
    await client.exec({ query: 'SET enable_json_type = 1' })

    await client.command({
        query: 'DROP TABLE IF EXISTS user_events',
    })

    // Event object
    await client.exec({
        query: `
            CREATE TABLE user_events
            (
                name String,
                project_id UInt32,
                user_id UInt32,
                uuid UUID,
                created_at DateTime64(3, 'UTC'),
                data JSON
            )
            ENGINE MergeTree()
            PRIMARY KEY (project_id, user_id, name)
            ORDER BY (project_id, user_id, name, created_at)
            ${isTest ? '' : 'PARTITION BY project_id'}
        `,
    })

    await client.command({
        query: 'DROP TABLE IF EXISTS users',
    })

    // User object
    await client.exec({
        query: `
            CREATE TABLE users
            (
                id UInt32,
                project_id UInt32,
                anonymous_id String,
                external_id String,
                email String,
                phone String,
                timezone String,
                locale String,
                data JSON,
                created_at DateTime64(3, 'UTC'),
                updated_at DateTime64(3, 'UTC'),
                sign Int8,
                version UInt64 MATERIALIZED toUnixTimestamp64Nano(updated_at)
            )
            ENGINE = VersionedCollapsingMergeTree(sign, version)
            ORDER BY (project_id, id, created_at)
            ${isTest ? '' : 'PARTITION BY project_id'}
        `,
    })

    await redis.set('migration:lists', JSON.stringify(true))
    await redis.set('migration:events', JSON.stringify(true))
    await redis.set('migration:users', JSON.stringify(true))
}

exports.down = async function() {
    const client = clickhouse.createClient({
        url: process.env.CLICKHOUSE_URL,
        username: process.env.CLICKHOUSE_USERNAME,
        password: process.env.CLICKHOUSE_PASSWORD,
    })

    await client.command({
        query: 'DROP TABLE IF EXISTS user_events',
    })

    await client.command({
        query: 'DROP TABLE IF EXISTS users',
    })
}
