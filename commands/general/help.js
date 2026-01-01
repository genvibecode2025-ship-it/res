const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(config.defaultColor)
            .setTitle('🤖 Bot Commands')
            .setDescription('Here are the available commands for the Welcomer Bot:')
            .addFields(
                { name: '🛠️ Admin Commands', value: '`/welcome channel` - Set welcome channel\n`/welcome message` - Set custom message\n`/welcome dm` - Toggle DM welcomes\n`/welcome status` - View settings\n`/welcome test` - Test the welcome' },
                { name: 'ℹ️ General', value: '`/help` - Show this menu' }
            )
            .setFooter({ text: 'Developed with Zencoder' });

        await interaction.reply({ embeds: [embed] });
    },
};
