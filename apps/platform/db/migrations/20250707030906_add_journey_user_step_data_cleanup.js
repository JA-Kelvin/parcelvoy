exports.up = async function(knex) {
    await knex.schema.table('journey_user_step', function(table) {
        table.enum('data_state', ['active', 'available', 'cleared']).defaultTo('active').notNullable()
        table.index('data_state')
    })
}

exports.down = async function(knex) {
    await knex.schema.table('journey_user_step', function(table) {
        table.dropColumn('data_state')
    })
}
