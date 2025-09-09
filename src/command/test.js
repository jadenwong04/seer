const BaseCommand = require('../util/base_command')

module.exports = class Test extends BaseCommand {
    constructor(){
        super('test', 'Replies with success!')
    }

    async execute(interaction){
        await interaction.reply('Success!')
    }
}