import { createClient, ClickHouseClient as ClickHouse } from '@clickhouse/client'

export { ClickHouse }

export interface ClickhouseConfig {
    url: string
    username: string
    password?: string
    database?: string
}

export default (config: ClickhouseConfig) => {
    return createClient({
        ...config,
        clickhouse_settings: {
            // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
            date_time_input_format: 'best_effort',
            output_format_json_quote_64bit_integers: 0, // Disable quoting of 64-bit integers
            async_insert: 1,
            wait_for_async_insert: 1,
            async_insert_deduplicate: 1,
            async_insert_busy_timeout_ms: 1000,
        },
    })
}
