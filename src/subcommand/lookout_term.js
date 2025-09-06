const { name } = require("../../package.json")
const SubCommand = require('../util/discord/sub_command')
const mysql_connector_fn = require("../database/mysql_session.js")
const redis_connector_fn = require("../database/redis_client.js")
const { 
    WriteOperation,
    get_lookout_terms,
    write_lookout_terms
} = require("../database/db_helper")
const { 
    ActionRowBuilder,
    TextInputBuilder,
    ModalBuilder,
    MessageFlags,
    TextInputStyle
} = require("discord.js")
const { 
    build_paging_component,
    build_listing_embed,
    setup_paging_collector 
} = require("../util/discord/interactive_component.js")
const ModalHandler = require("../util/modal_handler.js")

module.exports = class LookoutTerm extends SubCommand{
    constructor(){
        super('setting', 'lookout_term', `Terms that ${name} should be looking out for.`)
        this.discord_client = require("../discord_client.js")
        this.interact_input_interval = 120_000
        this.max_lookout_term_length = 25
        this.listing_config = {
            "title": "Lookout Terms",
            "color": 39423,
            "page_size": 10
        }
        this.modal_handler = ModalHandler.get_instance()
        this.modal_handler.register("add_term", this, "add_term")
        this.modal_handler.register("delete_term", this, "delete_term")
        this.modal_handler.register("update_term", this, "update_term")
    }

    async async_init(){
        this.redis_client = await redis_connector_fn()
        this.mysql_session = await mysql_connector_fn()
        return this
    }

    async execute(interaction){
        const input_action = interaction.options.getString('action')
        const write_input_modal = new ModalBuilder()
        const term_input = new TextInputBuilder()
            .setCustomId("term")
            .setLabel("term")
            .setStyle(TextInputStyle.Short)       
        const offset_input = new TextInputBuilder()
            .setCustomId("offset")
            .setLabel("offset")
            .setStyle(TextInputStyle.Short)

        switch(input_action) {
            case 'show':
                const paging_component = build_paging_component()
                const lookout_term = await get_lookout_terms(this.mysql_session, this.redis_client, interaction.guildId)
                const lookout_term_embed_data = lookout_term.map(term => {
                    const [parsed_term, parsed_offset] = term.split(":")
                    return { name: parsed_term, value: parsed_offset }
                })

                const lookout_term_listing_embed = build_listing_embed(
                    this.listing_config,
                    lookout_term_embed_data,
                    1
                )

                const show_term_response = await interaction.reply(
                    {
                        embeds: [lookout_term_listing_embed],
                        components: [paging_component],
                        flags: MessageFlags.Ephemeral,
                        withResponse: true,
                    }
                )

                setup_paging_collector(interaction, show_term_response, this.interact_input_interval, lookout_term_embed_data, this.listing_config)

                break;
            case 'add':
                write_input_modal.setCustomId("add_term")
                write_input_modal.setTitle("Add Lookout Term")
                write_input_modal.addComponents(
                    new ActionRowBuilder().addComponents(term_input),
                    new ActionRowBuilder().addComponents(offset_input)
                )
                await interaction.showModal(write_input_modal)
                break;
            case 'delete':
                write_input_modal.setCustomId("delete_term")
                write_input_modal.setTitle("Delete Lookout Term")
                write_input_modal.addComponents(
                    new ActionRowBuilder().addComponents(term_input)
                )
                await interaction.showModal(write_input_modal)
                break;
            case 'update':
                write_input_modal.setCustomId("update_term")
                write_input_modal.setTitle("Update Lookout Term")
                write_input_modal.addComponents(
                    new ActionRowBuilder().addComponents(term_input),
                    new ActionRowBuilder().addComponents(offset_input)
                )
                await interaction.showModal(write_input_modal)
                break;
            default:
                await interaction.reply({
                    content: 'Invalid Action Chosen',
                    flags: MessageFlags.Ephemeral
                })
        }
    }

    async add_term({ guild_id, submission_field }) {
        await write_lookout_terms(
            this.mysql_session,
            this.redis_client,
            guild_id,
            submission_field.get('term').value,
            Number(submission_field.get('offset').value),
            WriteOperation.insert
        )
    }
    
    async update_term({ guild_id, submission_field }) {
        await write_lookout_terms(
            this.mysql_session,
            this.redis_client,
            guild_id,
            submission_field.get('term').value,
            Number(submission_field.get('offset').value),
            WriteOperation.update
        )
    }

    async delete_term({ guild_id, submission_field }) {
        await write_lookout_terms(
            this.mysql_session,
            this.redis_client,
            guild_id,
            submission_field.get('term').value,
            null,
            WriteOperation.delete
        )
    }

    validate_offset(term, offset){
        return offset <= Math.ceil(term.length / 2)
    }

    addBaseCmd(base_cmd_ref){
        base_cmd_ref.addSubcommand(subcommand => 
            subcommand.setName(this.name)
                .setDescription(this.description)
                .addStringOption(option => option
                    .setName('action')
                    .setDescription('choose an action')
                    .addChoices(
                        { name: 'show-terms', value: 'show' },
                        { name: 'add-term', value: 'add' },
                        { name: 'delete-term', value: 'delete' },
                        { name: 'update-term', value: 'update' }
                    )
                    .setRequired(true)
                )
        )
    }
}