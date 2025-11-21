import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('campaign_sends', (table) => {
        table.timestamp('sent_at').nullable().index('idx_campaign_sends_sent_at')
    })
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('campaign_sends', (table) => {
        table.dropIndex(['sent_at'], 'idx_campaign_sends_sent_at')
        table.dropColumn('sent_at')
    })
}
