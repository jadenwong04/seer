const { name } = require('../../package.json')
const SubCommand = require('../util/sub_command')
const mysql_connector_fn = require("../database/mysql_session.js")
const redis_connector_fn = require("../database/redis_client.js")
const {
    ActionRowBuilder,
    RoleSelectMenuBuilder,
    MessageFlags,
    ComponentType,
    roleMention,
    userMention
} = require("discord.js")
const {
    WriteOperation,
    get_authorized_role,
    write_authorized_role
} = require("../database/db_helper.js")

module.exports = class AuthorizeRole extends SubCommand {
    constructor(){
        super('setting', 'authorize_role', `Specify roles that have access to ${name}`)
        this.discord_client = require("../discord_client.js")
        this.role_select_input_interval = 60_000
    }

    async async_init(){
        this.redis_client = await redis_connector_fn()
        this.mysql_session = await mysql_connector_fn()
        return this
    }   

    async execute(interaction){
        const input_action = interaction.options.getString('action')

        switch(input_action) {
            case 'set':
                const authorized_role = await get_authorized_role(this.mysql_session, this.redis_client, interaction.guildId)

                const role_select = new RoleSelectMenuBuilder()
                    .setCustomId("role_input")
                    .setPlaceholder("select role")
                    .setMaxValues(1)
                    .setMinValues(0)
                
                if (authorized_role != "null") {
                    role_select.setDefaultRoles(authorized_role)
                }

                const role_select_component = new ActionRowBuilder().addComponents(role_select)

                const role_select_interaction = await interaction.reply(
                    {
                        content: `Select role that is authorized to access ${userMention(this.discord_client.user.id)}`,
                        components: [role_select_component],
                        flags: MessageFlags.Ephemeral,
                        withResponse: true,
                    }
                )

                const role_select_collector = role_select_interaction.resource.message.createMessageComponentCollector({
                    componentType: ComponentType.RoleSelect,
                    time: this.role_select_input_interval
                })

                role_select_collector.on('collect', async(component_interaction) => {
                    try {
                        let role_id, write_operation, follow_up_content

                        if (component_interaction.values.length > 0) {
                            [role_id] = component_interaction.values
                            write_operation = WriteOperation.update
                            follow_up_content = `Successfully set authorized role to ${roleMention(role_id)}.`
                        } else {
                            role_id = null
                            write_operation = WriteOperation.delete
                            follow_up_content = `Successfully removed existing authorized role.`
                        }

                        await write_authorized_role(
                            this.mysql_session,
                            this.redis_client,
                            interaction.guildId,
                            role_id,
                            write_operation
                        )

                        await interaction.followUp({
                            content: follow_up_content,
                            flags: MessageFlags.Ephemeral,
                        })
                    } catch {
                        await interaction.followUp({
                            content: `Failed to set an authorized role.`,
                            flags: MessageFlags.Ephemeral
                        })
                    }
                    component_interaction.deferUpdate()
                })

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
                        { name: 'set-role', value: 'set' }
                    )
                    .setRequired(true)
                )
        )
    }
}