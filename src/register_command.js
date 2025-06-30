require('dotenv').config()
const { REST, Routes, Collection } = require('discord.js')
const fs = require('node:fs')
const path = require('node:path')
const client = require('./discord_client.js')

module.exports = (guildId) => {
	client.base_command = new Collection();
	client.sub_command = new Collection();

	const base_command_path = path.join(__dirname, 'command');
	const base_commands = fs.readdirSync(base_command_path).filter(file => file.endsWith('.js'));
	for (const file of base_commands){
		const filePath = path.join(base_command_path, file)
		const command = require(filePath)
		const base_command_instance = new command()
		client.base_command.set(base_command_instance.name, base_command_instance)
	};

	const sub_command_path = path.join(__dirname, 'subcommand');
	const sub_commands = fs.readdirSync(sub_command_path).filter(file => file.endsWith('.js'));
	for (const file of sub_commands){
		const filePath = path.join(sub_command_path, file);
		const sub_command = require(filePath);
		const sub_command_instance = new sub_command();
		if (client.sub_command.get(sub_command_instance.base_command) == null){
			client.sub_command.set(sub_command_instance.base_command, new Collection())
		}
		client.sub_command.get(sub_command_instance.base_command).set(sub_command_instance.name, sub_command_instance)
	};
	
	const commands_json = client.base_command.map(base_cmd => {
		const base_cmd_data = base_cmd.getData()
		client.sub_command.get(base_cmd.name)?.forEach(sub_cmd => {
			sub_cmd.addBaseCmd(base_cmd_data)
		})
		return base_cmd_data.toJSON()
	});

	const rest = new REST().setToken(process.env.TOKEN);

	(async () => {
		try {
			console.log(`Begin registering commands for guild ${guildId}`);

			console.log(`Started refreshing ${commands_json.length} application (/) commands.`);

			const data = await rest.put( 	
				Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
				{ body: commands_json },
			);

			console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		} catch (error) {
			console.error(error);
		}
	})();		
}	