require('dotenv').config()
const { Events, EmbedBuilder } = require('discord.js')
const GuildMap = require('./conversation_map.js')
const discord_client = require('./discord_client.js')
const redis_client = require("./redis_client.js")
const cfg = require('../config.json')
const { hard_moderation } = require('./hard_moderation.js')

let connection
const guildMap = GuildMap.getInstance()

const get_hex_value = (d) => { return '0x' + d.toString(16).padStart(6, '0') }

client.on('ready', async () => {
    connection = await require('./database/db')
    await connection.query(`SELECT * FROM guild;`).then(([guildRec]) => {
        //initialize guild map
        guildRec.forEach((guild) => {
            guildMap.addGuild(guild.guild_id)
            //register command
            require('./register_command')(guild.guild_id)
        })
        //initialize channel map
        Array.from(guildMap.getKeys()).forEach(async (guildID) => {
            const guild = client.guilds.cache.get(guildID)
            if (guild){
                guild.channels.cache.forEach((channel) => {
                    guildMap.getValue(guild.id).addChannel(channel.id)
                })
            } else {
                console.error(`Guild ID ${guildID} cannot be found.`)
            }
        })
    }).catch((err) => {
        console.error(err)
    })
})

client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    await connection.query(
        `INSERT INTO user (user_id, user_name, guild_id) 
        VALUES ('${member.user.id}', '${member.user.username}', '${member.guild.id}');`
    )
})

client.on('guildMemberRemove', async (member) => {
    if (member.user.bot) return;
    await connection.query(
        `DELETE FROM user 
        WHERE guild_id = '${member.guild.id}'
        AND user_id = '${member.user.id}';`
    )
})

client.on('guildCreate', async (guild) => {
    try{
        await connection.query(
            `INSERT INTO guild (guild_id, guild_name, join_date)
            VALUES ('${guild.id}', '${guild.name}', "${new Date().toISOString().slice(0, 19).replace('T', ' ')}");`
        )

        await guild.members.fetch();

        guild.members.cache.filter(m => !m.user.bot).forEach(async (m) => {
            await connection.query(
                `INSERT INTO user (guild_id, user_id, user_name)
                VALUES('${m.guild.id}', '${m.user.id}', '${m.user.username}');`
            )
        })
    } catch(err) {
        console.error(err)
    }
    guildMap.addGuild(guild.id)

    await guild.channels.fetch();

    guild.channels.cache.forEach((channel) => {
        guildMap.getValue(guild.id).addChannel(channel.id)
    })
    require('./register_command')(guild.id)
})

client.on('guildDelete', async (guild) => {
    try{
        await connection.query(
            `DELETE FROM user
            WHERE guild_id = ${guild.id};`
        )
        await connection.query(
            `DELETE FROM guild
            WHERE guild_id = ${guild.id};`
        )
    } catch (err) {
        console.error(err)
    }
    guildMap.removeGuild(guild.id)
})

client.on('channelCreate', (channel) => {
    guildMap.getValue(channel.guild.id).addChannel(channel.id)
})

client.on('channelRemove', (channel) => {   
    guildMap.getValue(channel.guild.id).removeChannel(channel.id)
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

async function checkForModeration(msg){
    const [authorized_roles] = await connection.query(`SELECT * FROM guild_authorized_role WHERE guild_id = '${msg.guild.id}'`)
    const msg_author_roles_id = msg.guild.members.cache.get(msg.author.id).roles.cache.map(role => role.id)
    const [ignored_channels] = await connection.query(`SELECT * FROM guild_ignored_channel WHERE guild_id = '${msg.guild.id}'`)
    return msg.author.bot || authorized_roles.some(role => msg_author_roles_id.includes(role.role_id)) || ignored_channels.some(channel => channel.channel_id == msg.channelid)
}

const guildLeaderboardUpdate = async () => {
    const CHANNEL_NAME = "sentiment-leaderboard"
    await connection.query('SELECT guild_id FROM guild').then(([guilds]) => {
        guilds.forEach(async guild => {
            const guild_ref = client.guilds.cache.get(guild.guild_id)
            let ldb_upd_channel = guild_ref.channels.cache.find(channel => channel.name == CHANNEL_NAME)
            if (!ldb_upd_channel){
                ldb_upd_channel = await guild_ref.channels.create({
                    name: CHANNEL_NAME,
                    type: 0
                })
            }
            const ldb_count = (await connection.query(`SELECT ldb_count FROM guild WHERE guild_id = '${guild.guild_id}'`))[0][0].ldb_count
            const user_sorted = (await connection.query(`SELECT user_id, st_score FROM user WHERE guild_id = '${guild.guild_id}' ORDER BY st_score DESC`))[0]
            ldb_upd_channel.send({ embeds: [await leaderboard_embed_builder(ldb_count, user_sorted, guild_ref)] })
        })
    })
}

async function leaderboard_embed_builder(count, user, guild){
    await guild.members.fetch();
    const rank_val = Array.from({ length: user.length }, (_, index) => index + 1 + '.').join('\n')
    const user_val = user.slice(0, count).map(usr => guild.members.cache.get(usr.user_id).user).join('\n')
    const st_score_val = user.slice(0, count).map(usr => usr.st_score).join('\n')

    return new EmbedBuilder()
        .setTitle(`Sentiment Standouts: Top ${count}`)
        .setColor(Number(get_hex_value(cfg.ldb_embed_color)))
        .addFields(
            { name: 'Rank', value: rank_val, inline: true },
            { name: 'User', value: user_val, inline: true },
            { name: 'Sentiment Score', value: st_score_val, inline: true }
        )
        .setTimestamp()
}   

client.login(process.env.TOKEN);