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

        // Initialize DB
        if (!db.get(guildId)) {
            db.set(guildId, {
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
        if (!currentSettings.embed) currentSettings.embed = { color: config.defaultColor, title: "Welcome!", thumbnail: true };
        if (currentSettings.autorole === undefined) currentSettings.autorole = null;
        if (currentSettings.ping === undefined) currentSettings.ping = false;
        db.set(guildId, currentSettings);

        // Helper to update deeply
        const updateSetting = (key, value) => db.setDeep(guildId, key, value);
        const updateEmbed = (key, value) => {
            const s = db.get(guildId);
            s.embed[key] = value;
            db.set(guildId, s);
        };

        // --- HANDLERS ---
        
        if (subcommand === 'channel') {
            const ch = interaction.options.getChannel('target');
            updateSetting('channelId', ch.id);
            return interaction.reply({ content: `✅ Welcome channel set to ${ch}`, ephemeral: true });
        }

        if (subcommand === 'message') {
            const msg = interaction.options.getString('content');
            updateSetting('message', msg);
            return interaction.reply({ content: `✅ Message updated.`, ephemeral: true });
        }

        if (subcommand === 'dm') {
            const enabled = interaction.options.getBoolean('enabled');
            updateSetting('dmEnabled', enabled);
            return interaction.reply({ content: `✅ DM Welcome is now **${enabled ? 'ON' : 'OFF'}**.`, ephemeral: true });
        }

        if (subcommand === 'autorole') {
            const role = interaction.options.getRole('role');
            if (role) {
                // Security check
                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.reply({ content: '❌ I cannot assign this role because it is higher than or equal to my highest role.', ephemeral: true });
                }
                updateSetting('autorole', role.id);
                return interaction.reply({ content: `✅ Autorole set to **${role.name}**.`, ephemeral: true });
            } else {
                updateSetting('autorole', null);
                return interaction.reply({ content: `✅ Autorole disabled.`, ephemeral: true });
            }
        }

        if (subcommand === 'ping') {
            const enabled = interaction.options.getBoolean('enabled');
            updateSetting('ping', enabled);
            return interaction.reply({ content: `✅ User ping is now **${enabled ? 'ON' : 'OFF'}**.`, ephemeral: true });
        }

        // --- Embed Group Handlers ---
        if (subcommandGroup === 'embed') {
            if (subcommand === 'color') {
                let hex = interaction.options.getString('hex');
                if (!hex.startsWith('#')) hex = '#' + hex;
                if (!/^#[0-9A-F]{6}$/i.test(hex)) return interaction.reply({ content: '❌ Invalid Hex Code.', ephemeral: true });
                updateEmbed('color', hex);
                return interaction.reply({ embeds: [new EmbedBuilder().setColor(hex).setDescription(`✅ Embed color set to \`${hex}\``)] });
            }
            if (subcommand === 'title') {
                updateEmbed('title', interaction.options.getString('text'));
                return interaction.reply({ content: `✅ Embed title updated.`, ephemeral: true });
            }
            if (subcommand === 'image') {
                updateEmbed('image', interaction.options.getString('url'));
                return interaction.reply({ content: `✅ Embed image updated.`, ephemeral: true });
            }
            if (subcommand === 'thumbnail') {
                updateEmbed('thumbnail', interaction.options.getBoolean('show'));
                return interaction.reply({ content: `✅ Embed thumbnail updated.`, ephemeral: true });
            }
            if (subcommand === 'footer') {
                updateEmbed('footer', interaction.options.getString('text'));
                return interaction.reply({ content: `✅ Embed footer updated.`, ephemeral: true });
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
            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'test') {
            const s = db.get(guildId);
            if (!s.channelId) return interaction.reply({ content: '❌ Set a channel first!', ephemeral: true });
            await interaction.reply({ content: '🔄 Simulating...', ephemeral: true });
            interaction.client.emit('guildMemberAdd', interaction.member);
        }
    }
};
