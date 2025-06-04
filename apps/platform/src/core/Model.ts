import App from '../app'
import { Database } from '../config/database'
import { SQLModel } from './models/SQLModel'
import { clickhouseAll, clickhouseInsert, clickhouseQuery } from './models/ClickHouseModel'

export interface SearchResult<T> {
    results: T[]
    nextCursor?: string
    prevCursor?: string
    limit: number
}

export * from './models/ClickHouseModel'
export * from './models/RawModel'
export * from './models/SQLModel'

export default class Model extends SQLModel {
    id!: number

    static async findMap<T extends typeof Model>(
        this: T,
        ids: number[],
        db: Database = App.main.db,
    ) {
        const m = new Map<number, InstanceType<T>>()
        if (!ids.length) return m
        const records = await this.all(q => q.whereIn('id', ids), db)
        for (const record of records) {
            m.set(record.id, record)
        }
        return m
    }
}

export class UniversalModel extends Model {
    clickhouseInsert<T extends typeof UniversalModel>(this: T) {
        return clickhouseInsert(this, {})
    }

    static clickhouse<T extends typeof UniversalModel>(this: T) {
        return {
            insert: function(
                this: T,
                data: Partial<InstanceType<T>> | Partial<InstanceType<T>>[] = {},
                clickhouse = App.main.clickhouse,
            ) {
                return clickhouseInsert(this, data, clickhouse)
            }.bind(this),
            upsert: function(
                this: T,
                newRecord: Partial<InstanceType<T>>,
                oldRecord?: Partial<InstanceType<T>>,
                clickhouse = App.main.clickhouse,
            ) {
                const values = []
                if (oldRecord) {
                    values.push({
                        ...oldRecord,
                        updated_at: newRecord.updated_at,
                        sign: -1,
                    })
                }
                values.push({
                    ...newRecord,
                    sign: 1,
                })
                return clickhouseInsert(this, values, clickhouse)
            }.bind(this),
            all: function(
                this: T,
                query: string,
                params: any = {},
                clickhouse = App.main.clickhouse,
            ) {
                return clickhouseAll(this, query, params, clickhouse)
            }.bind(this),
            query: function(
                this: T,
                query: string,
                params: any = {},
                clickhouse = App.main.clickhouse,
            ) {
                return clickhouseQuery(this, query, params, clickhouse)
            }.bind(this),
            count: async function(
                query: string,
                params: any = {},
                clickhouse = App.main.clickhouse,
            ): Promise<number> {
                const result = await clickhouse.query({
                    query: `SELECT count() AS count from (${query})`,
                    query_params: params,
                    format: 'JSONEachRow',
                })
                const json = await result.json() as { count: number }[]
                return json[0].count
            },
        }
    }
}

export type ModelParams = 'id' | 'created_at' | 'updated_at' | 'parseJson' | 'project_id' | 'toJSON'
