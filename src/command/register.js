const BaseCommand = require('../util/base_command')
const fs = require('node:fs')
const path = require('node:path');

module.exports = class Register extends BaseCommand {
    constructor(){
        super('register', 'Register new commands and reload existing commands!')
    }

    async execute(interaction){
        await interaction.reply("Begin registering command...")
        await interaction.followUp("Removing cache from existing commands...")
        delete require.cache[require.resolve(path.join(__dirname, '../register_command'))]
        await interaction.followUp('Register new commands and reload existing commands...')
        require(path.join(__dirname, '../register_command'))(interaction.guild.id)
        await interaction.followUp("Complete!")
    }
}