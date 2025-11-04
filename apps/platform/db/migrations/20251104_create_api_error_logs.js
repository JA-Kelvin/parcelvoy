exports.up = async function(knex) {
    const exists = await knex.schema.hasTable('api_error_logs')
    if (exists) return

    await knex.schema.createTable('api_error_logs', function(table) {
        table.bigIncrements('id').primary()
        table.string('request_id', 64).nullable()
        table.string('method', 16).notNullable()
        table.string('path', 255).notNullable()
        table.integer('status').unsigned().notNullable()
        table.string('code', 64).nullable()
        table.text('message').notNullable()
        table.text('stack', 'longtext')
        table.integer('user_id').unsigned().nullable()
        table.integer('project_id').unsigned().nullable()
        table.json('context').nullable()
        table.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3)).notNullable()
        table.timestamp('updated_at', { precision: 3 }).defaultTo(knex.fn.now(3)).notNullable()

        table.index(['created_at'], 'idx_ael_created_at')
        table.index(['status'], 'idx_ael_status')
        table.index(['code'], 'idx_ael_code')
        table.index(['path'], 'idx_ael_path')
        table.index(['project_id', 'created_at'], 'idx_ael_project_time')
    })
}

exports.down = async function(knex) {
    const exists = await knex.schema.hasTable('api_error_logs')
    if (!exists) return
    await knex.schema.dropTable('api_error_logs')
}
