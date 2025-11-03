import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    // campaign_sends: optimize range queries by send_at and grouping by state
    await knex.schema.alterTable('campaign_sends', (table) => {
        table.index(['send_at', 'state'], 'idx_campaign_sends_send_at_state')
    })

    // campaigns: help project/channel/type filters after join
    await knex.schema.alterTable('campaigns', (table) => {
        table.index(['project_id', 'channel', 'type'], 'idx_campaigns_project_channel_type')
    })
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('campaign_sends', (table) => {
        table.dropIndex(['send_at', 'state'], 'idx_campaign_sends_send_at_state')
    })
    await knex.schema.alterTable('campaigns', (table) => {
        table.dropIndex(['project_id', 'channel', 'type'], 'idx_campaigns_project_channel_type')
    })
}
