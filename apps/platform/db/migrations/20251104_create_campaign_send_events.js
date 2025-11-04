exports.up = async function(knex) {
    const exists = await knex.schema.hasTable('campaign_send_events')
    if (exists) return

    await knex.schema.createTable('campaign_send_events', function(table) {
        table.bigIncrements('id').primary()
        table.integer('project_id').unsigned().notNullable()
        table.integer('campaign_id').unsigned().notNullable()
        table.integer('user_id').unsigned().notNullable()
        table.string('channel', 24).notNullable()
        table.string('event', 24).notNullable()
        table.enum('reference_type', ['journey', 'trigger']).nullable()
        table.string('reference_id', 64).nullable().defaultTo('0')
        table.integer('provider_id').unsigned().nullable()
        table.string('provider_message_id', 128).nullable()
        table.json('meta').nullable()
        table.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3)).notNullable()
        table.timestamp('updated_at', { precision: 3 }).defaultTo(knex.fn.now(3)).notNullable()

        table.index(['project_id', 'created_at'], 'idx_cse_project_time')
        table.index(['campaign_id', 'created_at'], 'idx_cse_campaign_time')
        table.index(['project_id', 'channel', 'created_at'], 'idx_cse_project_channel_time')
        table.index(['user_id', 'campaign_id'], 'idx_cse_user_campaign')
        table.unique(['project_id','campaign_id','user_id','reference_id','event','created_at'], 'uniq_cse_natural')
        table.unique(['project_id','provider_id','provider_message_id','event'], 'uniq_cse_provider')
    })
}

exports.down = async function(knex) {
    const exists = await knex.schema.hasTable('campaign_send_events')
    if (!exists) return
    await knex.schema.dropTable('campaign_send_events')
}
