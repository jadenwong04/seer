const { name } = require('../../package.json')
const SubCommand = require('../util/discord/sub_command')
const mysql_connector_fn = require("../database/mysql_session.js")
const redis_connector_fn = require("../database/redis_client.js")
const { 
    WriteOperation, 
    get_ignored_channels, 
    write_ignored_channel 
} = require("../database/db_helper")
const { 
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    MessageFlags,
    channelMention,
    userMention
} = require("discord.js")
const { 
    build_paging_component,
    build_listing_embed,
    setup_paging_collector 
} = require("../util/discord/interactive_component.js")

module.exports = class IgnoreChannel extends SubCommand {
    constructor(){
        super('setting', 'ignore_channel', `Channels that should not moderated by ${name}`)
        this.discord_client = require("../discord_client.js")
        this.interact_input_interval = 120_000
        this.channel_select_input_interval = 60_000
        this.listing_config = {
            "title": "Ignored Channels",
            "color": 39423,
            "page_size": 5
        }
    }

    async async_init(){
        this.redis_client = await redis_connector_fn()
        this.mysql_session = await mysql_connector_fn()
        return this
    }   

    async execute(interaction){
        const input_action = interaction.options.getString('action')
        const channel_select_component = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId("channel_input")
                .setPlaceholder("select channel")
        )

        switch(input_action) {
            case 'show':
                const paging_component = build_paging_component()
                const guild = await this.discord_client.guilds.fetch(interaction.guildId)
                const ignored_channel_id = await get_ignored_channels(this.mysql_session, this.redis_client, interaction.guildId)
                const ignored_channel = await Promise.all(ignored_channel_id.map(channel_id => guild.channels.fetch(channel_id)))
                const ignored_channel_embed_data = ignored_channel.map(channel => ({ name: channel.id, value: channel.name, }))

                const ignored_channel_listing_embed = build_listing_embed(
                    this.listing_config,
                    ignored_channel_embed_data,
                    1
                )
                
                const show_channel_response = await interaction.reply(
                    { 
                        embeds: [ignored_channel_listing_embed],
                        components: [paging_component],
                        flags: MessageFlags.Ephemeral,
                        withResponse: true,
                    }
                );

                setup_paging_collector(interaction, show_channel_response, this.interact_input_interval, ignored_channel_embed_data, this.listing_config)

                break;
            case 'add':
                const add_channel_response = await interaction.reply(
                    {
                        content: `Add a channel to be ignored by ${userMention(this.discord_client.user.id)}`,
                        components: [channel_select_component],
                        withResponse: true,
                        flags: MessageFlags.Ephemeral,
                    }
                );

                try {
                    const channel_select = await add_channel_response.resource.message.awaitMessageComponent({ time: this.channel_select_input_interval })
                    try {
                        await write_ignored_channel(
                            this.mysql_session, 
                            this.redis_client,
                            interaction.guildId,
                            channel_select.values[0],
                            WriteOperation.insert 
                        )
                        await interaction.followUp({ content: `Successfully added ${channelMention(channel_select.values[0])} to ignored channels.`, flags: MessageFlags.Ephemeral })
                    } catch {
                        await interaction.followUp({ content: `Failed to add ${channelMention(channel_select.values[0])} to ignored channels.`, flags: MessageFlags.Ephemeral })
                    }
                    channel_select.deferUpdate()
                } catch {
                    await interaction.followUp({ content: "Command execution not completed within specified time interval."})
                }

                break;
            case 'delete':
                const remove_channel_response = await interaction.reply(
                    {
                        content: `Remove a channel that is ignored by ${userMention(this.discord_client.user.id)}`,
                        components: [channel_select_component],
                        withResponse: true,
                        flags: MessageFlags.Ephemeral,
                    }
                );

                try {
                    const channel_select = await remove_channel_response.resource.message.awaitMessageComponent({ time: this.channel_select_input_interval })
                    try {
                        await write_ignored_channel(
                            this.mysql_session, 
                            this.redis_client,
                            interaction.guildId,
                            channel_select.values[0],
                            WriteOperation.delete 
                        )
                        await interaction.followUp({ content: `Successfully removed ${channelMention(channel_select.values[0])} from ignored channels.`, flags: MessageFlags.Ephemeral })
                    } catch {
                        await interaction.followUp({ content: `Failed to remove ${channelMention(channel_select.values[0])} from ignored channels.`, flags: MessageFlags.Ephemeral })
                    }
                    channel_select.deferUpdate()
                } catch {
                    await interaction.followUp({ content: "Command execution not completed within specified time interval | Abort Command Execution."})
                }

                break;
            default:
                await interaction.reply({
                    content: 'Invalid Action Chosen',
                    flags: MessageFlags.Ephemeral
                })
        }
    }

    addBaseCmd(base_cmd_ref){
        base_cmd_ref.addSubcommand(subcommand => 
            subcommand.setName(this.name)
                .setDescription(this.description)
                .addStringOption(option => option
                    .setName('action')
                    .setDescription('choose an action')
                    .addChoices(
                        { name: 'show-channels', value: 'show' },
                        { name: 'add-channel', value: 'add' },
                        { name: 'delete-channel', value: 'delete' }
                    )
                    .setRequired(true)
                )
        )
    }
}