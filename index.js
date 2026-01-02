require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    REST, 
    Routes, 
    Events 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ==========================================
// 1. CONFIGURATION
// ==========================================
const CONFIG = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID, // Not strictly needed for runtime if using client.user.id
    defaultColor: '#0099ff'
};

// ==========================================
// 2. DATABASE UTILITY (JSON)
// ==========================================
class JsonDB {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = {};
        this.load();
    }

    load() {
        if (!fs.existsSync(this.filePath)) {
            // Create directory if it doesn't exist
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            this.saveSync();
        } else {
            try {
                const fileContent = fs.readFileSync(this.filePath, 'utf-8');
                this.data = JSON.parse(fileContent);
            } catch (err) {
                console.error("Database load error:", err);
                this.data = {};
            }
        }
    }

    // Synchronous save for initialization
    saveSync() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }

    // Asynchronous save for runtime
    async save() {
        try {
            await fs.promises.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (err) {
            console.error("Database save error:", err);
        }
    }

    get(key) {
        return this.data[key];
    }

    async set(key, value) {
        this.data[key] = value;
        await this.save();
    }

    async delete(key) {
        delete this.data[key];
        await this.save();
    }

    // Advanced nested get
    getDeep(guildId, key) {
        if (!this.data[guildId]) return null;
        return this.data[guildId][key];
    }

    // Advanced nested set
    async setDeep(guildId, key, value) {
        if (!this.data[guildId]) this.data[guildId] = {};
        this.data[guildId][key] = value;
        await this.save();
    }
}

const db = new JsonDB(path.join(__dirname, 'data/database.json'));

// ==========================================
// 3. COMMANDS DEFINITION
// ==========================================
const commands = new Map();

// --- COMMAND: HELP ---
const helpCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(CONFIG.defaultColor)
            .setTitle('🤖 Bot Commands')
            .setDescription('Here are the available commands for the Welcomer Bot:')
            .addFields(
                { name: '🛠️ Admin Commands', value: '`/welcome channel` - Set welcome channel\n`/welcome message` - Set custom message\n`/welcome dm` - Toggle DM welcomes\n`/welcome status` - View settings\n`/welcome test` - Test the welcome' },
                { name: 'ℹ️ General', value: '`/help` - Show this menu' }
            )
            .setFooter({ text: 'Developed with Zencoder' });

        await interaction.reply({ embeds: [embed] });
    }
};
commands.set(helpCommand.data.name, helpCommand);

// --- COMMAND: WELCOME ---
const welcomeCommand = {
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
        if (subcommand !== 'test') { 
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
                    color: CONFIG.defaultColor,
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
        if (!currentSettings.embed) { currentSettings.embed = { color: CONFIG.defaultColor, title: "Welcome!", thumbnail: true }; settingsChanged = true; }
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
                .setColor(e.color || CONFIG.defaultColor)
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
commands.set(welcomeCommand.data.name, welcomeCommand);

// ==========================================
// 4. CLIENT & EVENTS
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

// --- EVENT: READY ---
client.once(Events.ClientReady, async (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);

    // Register Commands
    const rest = new REST({ version: '10' }).setToken(CONFIG.token);
    const commandData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

    try {
        console.log(`Started refreshing ${commandData.length} application (/) commands.`);
        await rest.put(
            Routes.applicationCommands(c.user.id),
            { body: commandData },
        );
        console.log(`Successfully reloaded application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
});

// --- EVENT: INTERACTION CREATE ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        // Ignore "Unknown interaction" error (10062)
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
            console.error("Failed to send error message to user:", err);
        }
    }
});

// --- EVENT: GUILD MEMBER ADD ---
client.on(Events.GuildMemberAdd, async (member) => {
    const guildId = member.guild.id;
    const settings = db.get(guildId);

    // If no settings or no channel configured, do nothing
    if (!settings || !settings.channelId) return;

    // Ensure defaults
    const s = {
        ...settings,
        embed: settings.embed || { color: CONFIG.defaultColor, title: "Welcome!", thumbnail: true }
    };

    // --- AUTOROLE ---
    if (s.autorole) {
        try {
            const role = member.guild.roles.cache.get(s.autorole);
            if (role) {
                await member.roles.add(role);
            } else {
                console.warn(`Autorole ${s.autorole} not found in guild ${guildId}`);
            }
        } catch (err) {
            console.error(`Failed to assign autorole in guild ${guildId}:`, err.message);
        }
    }

    // --- MESSAGE PARSING ---
    const parseText = (text) => {
        if (!text) return "";
        return text
            .replace(/{user}/g, member.toString())
            .replace(/{username}/g, member.user.username)
            .replace(/{tag}/g, member.user.tag)
            .replace(/{server}/g, member.guild.name)
            .replace(/{memberCount}/g, member.guild.memberCount)
            .replace(/{count}/g, member.guild.memberCount);
    };

    const description = parseText(s.message || "Welcome {user} to {server}!");
    const title = parseText(s.embed.title);
    const footer = parseText(s.embed.footer);

    // --- EMBED CONSTRUCTION ---
    const embed = new EmbedBuilder()
        .setColor(s.embed.color || CONFIG.defaultColor)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

    if (s.embed.thumbnail) {
        embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
    }

    if (s.embed.image) {
        embed.setImage(s.embed.image);
    }

    if (footer) {
        embed.setFooter({ text: footer });
    }

    // --- SENDING ---
    let channel = member.guild.channels.cache.get(s.channelId);
    if (!channel) {
        try {
            channel = await member.guild.channels.fetch(s.channelId);
        } catch (err) {
            console.error(`Could not fetch channel ${s.channelId}`);
            return;
        }
    }
    
    if (channel) {
        try {
            const payload = { embeds: [embed] };
            if (s.ping) {
                payload.content = member.toString();
            }
            await channel.send(payload);
        } catch (err) {
            console.error(`Could not send welcome message to channel ${channel.id}:`, err);
        }
    }

    // --- DM SENDING ---
    if (s.dmEnabled) {
        try {
            await member.send({ embeds: [embed] });
        } catch (err) {
            // Ignore DM errors
        }
    }
});

// ==========================================
// 5. HTTP SERVER (For Render/Railway)
// ==========================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Health check server listening on port ${PORT}`);
});

// ==========================================
// 6. LOGIN
// ==========================================
client.login(CONFIG.token);
