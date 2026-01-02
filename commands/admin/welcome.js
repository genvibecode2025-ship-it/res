const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Ultimate Welcome System Configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // --- Core Settings ---
        .addSubcommand(subcommand =>
            subcommand.setName('channel')
                .setDescription('Set the welcome channel')
                .addChannelOption(option => option.setName('target').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('message')
                .setDescription('Set the text content (Description)')
                .addStringOption(option => option.setName('content').setDescription('Variables: {user}, {server}, {count}').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('dm')
                .setDescription('Toggle DM welcome messages')
                .addBooleanOption(option => option.setName('enabled').setDescription('Enable DMs?').setRequired(true)))
        // --- Autorole ---
        .addSubcommand(subcommand =>
            subcommand.setName('autorole')
                .setDescription('Set a role to give automatically on join')
                .addRoleOption(option => option.setName('role').setDescription('Role to give (Leave empty to disable)').setRequired(false)))
        // --- Advanced Embed ---
        .addSubcommandGroup(group =>
            group.setName('embed')
                .setDescription('Customize the welcome embed appearance')
                .addSubcommand(sub =>
                    sub.setName('color')
                        .setDescription('Set embed color (Hex code)')
                        .addStringOption(option => option.setName('hex').setDescription('e.g. #FF0000').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('title')
                        .setDescription('Set embed title')
                        .addStringOption(option => option.setName('text').setDescription('Title text').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('image')
                        .setDescription('Set main image URL (Banner)')
                        .addStringOption(option => option.setName('url').setDescription('Image URL').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('thumbnail')
                        .setDescription('Toggle user avatar thumbnail')
                        .addBooleanOption(option => option.setName('show').setDescription('Show user avatar?').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('footer')
                        .setDescription('Set footer text')
                        .addStringOption(option => option.setName('text').setDescription('Footer text').setRequired(true)))
        )
        // --- Extras ---
        .addSubcommand(subcommand =>
            subcommand.setName('ping')
                .setDescription('Toggle pinging the user outside the embed')
                .addBooleanOption(option => option.setName('enabled').setDescription('Ping user?').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('status')
                .setDescription('View current configuration'))
        .addSubcommand(subcommand =>
            subcommand.setName('test')
                .setDescription('Simulate a welcome event')),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        let subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup();
        
        // Defer reply immediately to prevent timeout
        if (subcommand !== 'test') { // Test handles its own reply flow usually, but we can unify.
             await interaction.deferReply({ ephemeral: true });
        }

        // Initialize DB
        if (!db.get(guildId)) {
            await db.set(guildId, {
                channelId: null,
                message: "Welcome {user} to {server}!",
                dmEnabled: false,
                autorole: null,
                embed: {
                    color: config.defaultColor,
                    title: "Welcome!",
                    image: null,
                    thumbnail: true,
                    footer: "Member #{count}"
                },
                ping: false
            });
        }
        
        // Ensure new fields exist for old DB entries
        const currentSettings = db.get(guildId);
        let settingsChanged = false;
        if (!currentSettings.embed) { currentSettings.embed = { color: config.defaultColor, title: "Welcome!", thumbnail: true }; settingsChanged = true; }
        if (currentSettings.autorole === undefined) { currentSettings.autorole = null; settingsChanged = true; }
        if (currentSettings.ping === undefined) { currentSettings.ping = false; settingsChanged = true; }
        
        if (settingsChanged) {
            await db.set(guildId, currentSettings);
        }

        // Helper to update deeply
        const updateSetting = async (key, value) => await db.setDeep(guildId, key, value);
        const updateEmbed = async (key, value) => {
            const s = db.get(guildId);
            s.embed[key] = value;
            await db.set(guildId, s);
        };

        // --- HANDLERS ---
        
        if (subcommand === 'channel') {
            const ch = interaction.options.getChannel('target');
            await updateSetting('channelId', ch.id);
            return interaction.editReply({ content: `✅ Welcome channel set to ${ch}` });
        }

        if (subcommand === 'message') {
            const msg = interaction.options.getString('content');
            await updateSetting('message', msg);
            return interaction.editReply({ content: `✅ Message updated.` });
        }

        if (subcommand === 'dm') {
            const enabled = interaction.options.getBoolean('enabled');
            await updateSetting('dmEnabled', enabled);
            return interaction.editReply({ content: `✅ DM Welcome is now **${enabled ? 'ON' : 'OFF'}**.` });
        }

        if (subcommand === 'autorole') {
            const role = interaction.options.getRole('role');
            if (role) {
                // Security check
                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.editReply({ content: '❌ I cannot assign this role because it is higher than or equal to my highest role.' });
                }
                await updateSetting('autorole', role.id);
                return interaction.editReply({ content: `✅ Autorole set to **${role.name}**.` });
            } else {
                await updateSetting('autorole', null);
                return interaction.editReply({ content: `✅ Autorole disabled.` });
            }
        }

        if (subcommand === 'ping') {
            const enabled = interaction.options.getBoolean('enabled');
            await updateSetting('ping', enabled);
            return interaction.editReply({ content: `✅ User ping is now **${enabled ? 'ON' : 'OFF'}**.` });
        }

        // --- Embed Group Handlers ---
        if (subcommandGroup === 'embed') {
            if (subcommand === 'color') {
                let hex = interaction.options.getString('hex');
                if (!hex.startsWith('#')) hex = '#' + hex;
                if (!/^#[0-9A-F]{6}$/i.test(hex)) return interaction.editReply({ content: '❌ Invalid Hex Code.' });
                await updateEmbed('color', hex);
                return interaction.editReply({ embeds: [new EmbedBuilder().setColor(hex).setDescription(`✅ Embed color set to \`${hex}\``)] });
            }
            if (subcommand === 'title') {
                await updateEmbed('title', interaction.options.getString('text'));
                return interaction.editReply({ content: `✅ Embed title updated.` });
            }
            if (subcommand === 'image') {
                await updateEmbed('image', interaction.options.getString('url'));
                return interaction.editReply({ content: `✅ Embed image updated.` });
            }
            if (subcommand === 'thumbnail') {
                await updateEmbed('thumbnail', interaction.options.getBoolean('show'));
                return interaction.editReply({ content: `✅ Embed thumbnail updated.` });
            }
            if (subcommand === 'footer') {
                await updateEmbed('footer', interaction.options.getString('text'));
                return interaction.editReply({ content: `✅ Embed footer updated.` });
            }
        }

        if (subcommand === 'status') {
            const s = db.get(guildId);
            const e = s.embed;
            const embed = new EmbedBuilder()
                .setColor(e.color || config.defaultColor)
                .setTitle('⚙️ Ultimate Welcome Config')
                .addFields(
                    { name: 'Channel', value: s.channelId ? `<#${s.channelId}>` : '❌ Not Set', inline: true },
                    { name: 'Autorole', value: s.autorole ? `<@&${s.autorole}>` : '❌ Disabled', inline: true },
                    { name: 'DM', value: s.dmEnabled ? '✅' : '❌', inline: true },
                    { name: 'Ping User', value: s.ping ? '✅' : '❌', inline: true },
                    { name: 'Embed Title', value: e.title || 'Default', inline: true },
                    { name: 'Embed Footer', value: e.footer || 'Default', inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'test') {
             // For test, we handle it slightly differently to show "Simulating..."
             await interaction.deferReply({ ephemeral: true });
            const s = db.get(guildId);
            if (!s.channelId) return interaction.editReply({ content: '❌ Set a channel first!' });
            await interaction.editReply({ content: '🔄 Simulating...' });
            interaction.client.emit('guildMemberAdd', interaction.member);
        }
    }
};
