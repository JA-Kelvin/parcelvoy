import { pluralize, snakeCase } from '../../utilities'

export type ModelFormatOptions = {
    stringify: boolean
    timestamps: boolean
}

export class RawModel {
    static jsonAttributes: string[] = []
    static virtualAttributes: string[] = []

    static toJson<T extends typeof RawModel>(this: T, model: any) {
        const json: any = {}
        const keys = [...Object.keys(model), ...this.virtualAttributes]
        for (const key of keys) {
            json[snakeCase(key)] = model[key]
        }
        return json
    }

    static fromJson<T extends typeof RawModel>(this: T, json: Partial<InstanceType<T>>): InstanceType<T> {
        const model = new this()

        // Remove any value that could conflict with a virtual key
        for (const attribute of this.virtualAttributes) {
            delete (json as any)[attribute]
        }

        // Parse values into the model
        model.parseJson(json)
        return model as InstanceType<T>
    }

    parseJson(json: any) {
        Object.assign(this, json)
    }

    toJSON() {
        return (this.constructor as any).toJson(this)
    }

    // Format JSON before inserting into DB
    static formatJson(json: any, options: ModelFormatOptions = { stringify: true, timestamps: true }): Record<string, unknown> {

        // All models have an updated timestamp, trigger value
        if (options.timestamps) json.updated_at = new Date()

        // Take JSON attributes and stringify before insertion
        if (options.stringify) {
            for (const attribute of this.jsonAttributes) {
                json[attribute] = JSON.stringify(json[attribute])
            }
        }

        // remove any virtual attributes that have been set
        for (const attribute of this.virtualAttributes) {
            delete (json as any)[attribute]
        }

        return json
    }

    static get tableName(): string {
        return pluralize(snakeCase(this.name))
    }
}
