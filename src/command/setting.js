const BaseCommand = require('../util/base_command')

class Setting extends BaseCommand {
    constructor() {
        super('setting', 'Configure various settings for the bot!')
    }

    async execute(interaction){
        await interaction.reply('Configuring settings...')
    }
}

module.exports = Setting