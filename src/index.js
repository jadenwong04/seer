require('dotenv').config()
const { Events, inlineCode, MessageFlags } = require('discord.js')
const discord_client = require('./discord_client.js')
const config = require('../config.json')
const mysql_connector_fn = require("./database/mysql_session.js")
const redis_connector_fn = require("./database/redis_client.js")
const ModalHandler = require("./util/modal_handler.js")
const {
    get_ignored_channels,
    get_lookout_terms,
    get_authorized_role
} = require("./database/db_helper.js")
const {
    BannedTerm
} = require("./violation")
const rule_based_moderation_fn = require('./rule_based_moderation.js')

let modal_handler
let mysql_session
let redis_client

findValueGreaterThanZero = (map) => {
    for (const value of map.values()) {
        if (value > 0) return true
    }
    return false
}

discord_client.on(Events.ClientReady, async () => {
    try {
        mysql_session = await mysql_connector_fn()
    } catch(err) {
        console.error(`Error while connecting to MySQL Session | ${err}`)
        throw err
    }

    try {
        redis_client = await redis_connector_fn()
    } catch(err) {
        console.error(`Error while connecting to Redis Client | ${err}`)
        throw err
    }

    modal_handler = ModalHandler.get_instance()

    // handle missing events

    const guild_dc_client = await discord_client.guilds.fetch()
    const sorted_guild_id_dc_client = guild_dc_client.map(guild => guild.id)
    sorted_guild_id_dc_client.sort()

    const sorted_guild_id_db_snapshot = (
        await (
            await mysql_session.sql(
                `
                    SELECT guild_id 
                    FROM guild 
                    ORDER BY guild_id
                `
            ).execute()
        ).fetchAll()
    ).map(row => row[0]);

    const [guilds_to_insert, guilds_to_delete] = anti_match_join(sorted_guild_id_db_snapshot, sorted_guild_id_dc_client)

    if (guilds_to_insert.length > 0) {
        await mysql_session.sql(
            `
                INSERT INTO guild (guild_id) 
                VALUES ${guilds_to_insert.map(id => `(${id})`).join(",")};
            `
        ).execute()
    }

    if (guilds_to_delete.length > 0) {
        await mysql_session.sql(
            `
                UPDATE guild 
                SET guild_expiry = NOW() + ${config.guild_data_ttl.interval.quantity} INTERVAL ${config.guild_data_ttl.interval.unit}
                WHERE guild_id in (${guilds_to_delete.map(id => `${id}`).join(",")});
            `
        ).execute()
    }

    sorted_guild_id_dc_client.forEach(async guild_id => await require("./register_command.js")(guild_id))
})

discord_client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = discord_client.base_command.get(interaction.commandName);
        const subcommand = discord_client.sub_command.get(interaction.commandName)?.get(interaction.options.getSubcommand());

        try {
            await command.execute(interaction);
            if (subcommand) await subcommand.execute(interaction);
        } catch (e) {
            console.error(e);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    } 

    if (interaction.isModalSubmit()) {
        try {
            modal_handler.submit(
                interaction.customId, 
                { 
                    guild_id: interaction.guildId,
                    submission_field: interaction.fields.fields
                }
            )
            await interaction.reply({
                content: `Modal: ${inlineCode(interaction.customId)} Submitted Successfully!`,
                flags: MessageFlags.Ephemeral
            })
        } catch {
            await interaction.reply({
                content: `Modal: ${inlineCode(interaction.customId)} Failed!`,
                flags: MessageFlags.Ephemeral
            })
        }
    }
})

discord_client.on(Events.GuildCreate, async guild => {
    await mysql_session.sql(
        `
            INSERT INTO guild (guild_id)
            VALUES ${guild.id}
            ON DUPLICATE KEY 
            UPDATE guild_expiry = NULL;
        `
    ).execute()
})

discord_client.on(Events.GuildDelete, async guild => {
    await mysql_session.sql(
        `
            UPDATE guild 
            SET guild_expiry = NOW() + ${config.guild_data_ttl.interval.quantity} INTERVAL ${config.guild_data_ttl.interval.unit}
            WHERE guild_id = ${guild.id}
        `
    ).execute()
})

discord_client.on(Events.MessageCreate, async message => {
    const guild = await discord_client.guilds.fetch(message.guildId)
    const channel = await guild.channels.fetch(message.channelId)
    const member = await guild.members.fetch(message.author.id)
    
    const authorized_role = await get_authorized_role(mysql_session, redis_client, message.guildId)
    await get_ignored_channels(mysql_session, redis_client, message.guildId)

    if (
        await redis_client.sIsMember(`ignored_channels:${message.guildId}`, message.channelId) == 0 
        &&
        !member.roles.cache.some(role => role.id == authorized_role)
    ) {
        const lookout_violations = rule_based_moderation_fn(
            message.content,
            await get_lookout_terms(mysql_session, redis_client, message.guildId)
        )

        if (findValueGreaterThanZero(lookout_violations)) {
            new BannedTerm(
                message.author,
                guild,
                channel,
                message,
                lookout_violations
            ).warn()
        }
    }
})

function anti_match_join(sr_1, sr_2){
    const r1_m = [], r2_m = []
    let r1_p = 0, r2_p = 0

    while (r1_p < sr_1.length && r2_p < sr_2.length){
        if (sr_1[r1_p] == sr_2[r2_p]) {
            r1_p += 1
            r2_p += 1
        } else if (sr_1[r1_p] < sr_2[r2_p]) {
            r1_m.push(sr_1[r1_p])
            r1_p += 1
        } else {
            r2_m.push(sr_2[r2_p])
            r2_p += 1
        }
    }

    for (r1_p; r1_p < sr_1.length; r1_p++) {
        r2_m.push(sr_1[r1_p])
    }

    for (r2_p; r2_p < sr_2.length; r2_p++) {
        r1_m.push(sr_2[r2_p])
    }

    return [r1_m, r2_m]
}

discord_client.login(process.env.DC_TOKEN);