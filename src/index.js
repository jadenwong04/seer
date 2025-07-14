require('dotenv').config()
const { Events, EmbedBuilder } = require('discord.js')
const GuildMap = require('./conversation_map.js')
const discord_client = require('discord_client.js')
const config = require('../config.json')
const rule_based_moderation = require('rule_based_moderation.js')

let mysql_session, redis_client

discord_client.on('ready', async () => {
    mysql_session = require("database/mysql_session.js")()

    // handle guild related missed events while bot was down

    const guild_dc_client = await discord_client.guilds.fetch()

    const sorted_guild_id_db_snapshot = await mysql_session.sql(`SELECT guild_id FROM guild ORDER BY guild_id`)
        .execute()
        .fetchAll()
        .then(guild_rows => guild_rows.map(guild_row => guild_row[0]))

    const sorted_guild_id_dc_client = guild_dc_client.map(guild => guild.id).toSorted()

    const [guilds_to_insert, guilds_to_delete] = anti_match_join(sorted_guild_id_db_snapshot, sorted_guild_id_dc_client)

    await mysql_session.sql(
        `
            INSERT INTO guild (guild_id) 
            VALUES ${guilds_to_insert.map(id => `(${id})`).join(", ")};
        `
    ).execute()

    await mysql_session.sql(
        `
            UPDATE guild 
            SET guild_expiry = NOW() + ${config.guild_data_ttl.interval.quantity} INTERVAL ${config.guild_data_ttl.interval.unit}
            WHERE guild_id in (${guilds_to_delete.join(", ")});
        `
    ).execute()

    // handle member related missed events while bot was down

    const members_to_insert, members_to_delete = [], []

    const sorted_members_id_db_snapshot = await mysql_session.sql(
        `
            SELECT member_id, guild_id
            FROM member
            ORDER BY member_id 
            WHERE guild_id in (${sorted_guild_id_dc_client.join(", ")})
        `
    ).execute().fetchAll()

    for (const guild of guild_dc_client) {
        // register slash commands
        require("register_command.js")(guild.id)

        const sorted_members_id_dc_client = await guild.members.fetch()
            .then(members => members.map(member => member.user.id).sorted())

        const [partial_members_to_insert, partial_members_to_delete] = anti_match_join(sorted_members_id_db_snapshot
            .filter(member => member[1] == guild.id)
            .map(member => member[0]), sorted_members_id_dc_client)

        members_to_insert.extend(partial_members_to_insert.map(member_id => [member_id, guild.id]))
        members_to_delete.extend(partial_members_to_delete.map(member_id => [member_id, guild.id]))
    }

    await mysql_session.sql(
        `
            INSERT INTO members (member_id, guild_id) 
            VALUES ${members_to_insert.map(([member_id, guild_id]) => `(${member_id}, ${guild_id})`).join(", ")};
        `
    ).execute()

    await mysql_session.sql(
        `
            UPDATE members 
            SET member_expiry = NOW() + ${config.member_data_ttl.interval.quantity} INTERVAL ${config.member_data_ttl.interval.unit}
            WHERE member_id in (${members_to_delete.map(([member_id, guild_id]) => member_id).join(", ")}) and guild_id in (${members_to_delete.map(([member_id, guild_id]) => guild_id).join(", ")});
        `
    ).execute()
})

discord_client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    await connection.query(
        `
            INSERT INTO user (id, guild_id) 
            VALUES ('${member.user.id}', '${member.guild.id}');
        `
    )
})

client.on('guildCreate', async (guild) => {
    require('register_command.js')(guild.id)
    await mysql_session.sql(
    )
})

client.on('guildDelete', async (guild) => {
    await connection.query(
        `DELETE FROM user
        WHERE guild_id = ${guild.id};`
    )
    await connection.query(
        `DELETE FROM guild
        WHERE guild_id = ${guild.id};`
    )
})

client.on('messageCreate', async (msg) => {
    if (await checkForModeration(msg)) return;
    const mod_result = await mod(msg.id, msg.content, msg.guildId)
    if (mod_result) msg.author.send({ embeds: [mod_result] })
    guildMap.getValue(msg.guildId).getValue(msg.channelId).addMsg(msg.author.id, msg.id, msg.content)
})

client.on('messageUpdate', async (msg) => {
    if (await checkForModeration(msg)) return;
    guildMap.getValue(msg.guildId).getValue(msg.channelId).editMsg(msg.id, msg.content)
})

client.on('messageDelete', async (msg) => {
    if (await checkForModeration(msg)) return;
    guildMap.getValue(msg.guildId).getValue(msg.channelId).deleteMsg(msg.id)
})

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.base_command.get(interaction.commandName);
    const subcommand = client.sub_command.get(interaction.commandName)?.get(interaction.options.getSubcommand());

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
})

async function checkForModeration(msg) {
    const [authorized_roles] = await connection.query(`SELECT * FROM guild_authorized_role WHERE guild_id = '${msg.guild.id}'`)
    const msg_author_roles_id = msg.guild.members.cache.get(msg.author.id).roles.cache.map(role => role.id)
    const [ignored_channels] = await connection.query(`SELECT * FROM guild_ignored_channel WHERE guild_id = '${msg.guild.id}'`)
    return msg.author.bot || authorized_roles.some(role => msg_author_roles_id.includes(role.role_id)) || ignored_channels.some(channel => channel.channel_id == msg.channelid)
}

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
        r1_m.push(sr_1[r1_p])
    }

    for (r2_p; r2_p < sr_2.length; r2_p++) {
        r2_m.push(sr_2[r2_p])
    }

    return r1_m, r2_m
}

discord_client.login(process.env.TOKEN);