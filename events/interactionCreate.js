const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            // Ignore "Unknown interaction" error if it happens during execution (e.g. timeout)
            if (error.code === 10062) {
                console.warn(`Interaction ${interaction.id} expired or is unknown.`);
                return;
            }

            console.error(`Error executing ${interaction.commandName}`);
            console.error(error);
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            } catch (err) {
                // If we can't even tell the user there was an error, just log it.
                console.error("Failed to send error message to user:", err);
            }
        }
    },
};
