import { SQLModel } from '../core/Model'

export default class ApiErrorLog extends SQLModel {
    request_id?: string
    method!: string
    path!: string
    status!: number
    code?: string
    message!: string
    stack?: string
    user_id?: number
    project_id?: number
    context?: Record<string, unknown>

    static jsonAttributes = ['context']
}
