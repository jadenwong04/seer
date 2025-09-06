class SubCommand {
    constructor(base_command, name, description){
        this.base_command = base_command
        this.name = name
        this.description = description
    }

    async async_init() { return this }

    async execute(interaction) {
        await interaction.followUp('Pls Implement!')
    }

    get_base_command() {
        return this.base_command
    }

    addBaseCmd(base_cmd_ref){
        base_cmd_ref.addSubcommand(subcommand => 
            subcommand.setName(this.name)
                .setDescription(this.description)
        )
    }
}

module.exports = SubCommand