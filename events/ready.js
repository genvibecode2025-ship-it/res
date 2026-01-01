const { Events, REST, Routes } = require('discord.js');
const config = require('../config');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        const rest = new REST({ version: '10' }).setToken(config.token);
        const commands = [];
        
        client.commands.forEach(cmd => {
            commands.push(cmd.data.toJSON());
        });

        try {
            console.log(`Started refreshing ${commands.length} application (/) commands.`);

            // Register global commands (takes up to 1 hour to update, but easier for usage)
            // For instant updates in dev, use Routes.applicationGuildCommands(clientId, guildId)
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands },
            );

            console.log(`Successfully reloaded application (/) commands.`);
        } catch (error) {
            console.error(error);
        }
    },
};
