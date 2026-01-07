require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
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
    token: process. env.TOKEN,
    clientId: process.env.CLIENT_ID,
    defaultColor: '#0099ff'
};

// Token validation
if (!CONFIG.token || CONFIG.token === 'YOUR_BOT_TOKEN_HERE' || CONFIG.token.length < 50) {
    console.error('❌ Missing or invalid Discord bot token.  Set TOKEN in .env.');
    console.error('Token length:', CONFIG.token ?  CONFIG.token.length : 0);
    process.exit(1);
}

console.log('[config] Token loaded, length:', CONFIG.token. length);

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
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log('[db] Created data directory');
            }
            
            if (! fs.existsSync(this.filePath)) {
                this.saveSync();
                console.log('[db] Created new database file');
            } else {
                const fileContent = fs.readFileSync(this.filePath, 'utf-8');
                this.data = fileContent. trim() ? JSON.parse(fileContent) : {};
                console.log('[db] Loaded existing database');
            }
        } catch (err) {
            console.error("[db] Load error:", err.message);
            this.data = {};
        }
    }

    saveSync() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (err) {
            console. error("[db] Sync save error:", err.message);
        }
    }

    async save() {
        try {
            await fs.promises.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (err) {
            console.error("[db] Async save error:", err. message);
        }
    }

    get(key) {
        return this.data[key];
    }

    async set(key, value) {
        this. data[key] = value;
        await this.save();
    }

    async delete(key) {
        delete this.data[key];
        await this.save();
    }

    getDeep(guildId, key) {
        if (!this.data[guildId]) return null;
        return this.data[guildId][key];
    }

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

// --- COMMAND:  HELP ---
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
            .setFooter({ text: 'Developed with Zencoder' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
commands.set(helpCommand.data.name, helpCommand);

// --- COMMAND: WELCOME ---
const welcomeCommand = {
    data:  new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Ultimate Welcome System Configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand. setName('channel')
                .setDescription('Set the welcome channel')
                .addChannelOption(option => option. setName('target').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('message')
                .setDescription('Set the text content (Description)')
                .addStringOption(option => option.setName('content').setDescription('Variables: {user}, {server}, {count}').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand. setName('dm')
                .setDescription('Toggle DM welcome messages')
                .addBooleanOption(option => option.setName('enabled').setDescription('Enable DMs? ').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('autorole')
                .setDescription('Set a role to give automatically on join')
                .addRoleOption(option => option.setName('role').setDescription('Role to give (Leave empty to disable)').setRequired(false)))
        .addSubcommandGroup(group =>
            group.setName('embed')
                .setDescription('Customize the welcome embed appearance')
                .addSubcommand(sub =>
                    sub. setName('color')
                        .setDescription('Set embed color (Hex code)')
                        . addStringOption(option => option.setName('hex').setDescription('e.g.  #FF0000').setRequired(true)))
                .addSubcommand(sub =>
                    sub. setName('title')
                        . setDescription('Set embed title')
                        .addStringOption(option => option.setName('text').setDescription('Title text').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('image')
                        . setDescription('Set main image URL (Banner)')
                        . addStringOption(option => option.setName('url').setDescription('Image URL').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('thumbnail')
                        . setDescription('Toggle user avatar thumbnail')
                        .addBooleanOption(option => option.setName('show').setDescription('Show user avatar? ').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('footer')
                        .setDescription('Set footer text')
                        .addStringOption(option => option.setName('text').setDescription('Footer text').setRequired(true)))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('ping')
                .setDescription('Toggle pinging the user outside the embed')
                .addBooleanOption(option => option.setName('enabled').setDescription('Ping user?').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand. setName('status')
                .setDescription('View current configuration'))
        .addSubcommand(subcommand =>
            subcommand.setName('test')
                .setDescription('Simulate a welcome event')),

    async execute(interaction) {
        await interaction. deferReply({ ephemeral: true });

        if (! interaction.inGuild()) {
            return interaction.editReply({ content: '❌ This command can only be used in a server.' });
        }

        const guildId = interaction. guildId;
        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options. getSubcommandGroup(false);

        // Initialize default settings
        const defaultSettings = {
            channelId: null,
            message: "Welcome {user} to {server}!",
            dmEnabled: false,
            autorole: null,
            embed: {
                color: CONFIG.defaultColor,
                title:  "Welcome! ",
                image:  null,
                thumbnail: true,
                footer:  "Member #{count}"
            },
            ping: false
        };

        let currentSettings = db.get(guildId);
        if (!currentSettings) {
            await db.set(guildId, defaultSettings);
            currentSettings = defaultSettings;
        } else {
            // Migrate old settings
            let needsSave = false;
            if (! currentSettings.embed) {
                currentSettings.embed = defaultSettings.embed;
                needsSave = true;
            }
            if (currentSettings.autorole === undefined) {
                currentSettings.autorole = null;
                needsSave = true;
            }
            if (currentSettings.ping === undefined) {
                currentSettings.ping = false;
                needsSave = true;
            }
            if (needsSave) {
                await db.set(guildId, currentSettings);
            }
        }

        const updateSetting = async (key, value) => {
            await db.setDeep(guildId, key, value);
        };

        const updateEmbed = async (key, value) => {
            const s = db.get(guildId);
            if (! s.embed) s.embed = {};
            s.embed[key] = value;
            await db. set(guildId, s);
        };

        // Parse text helper
        const parseText = (text, member = interaction.member) => {
            if (! text) return '';
            return text
                .replace(/{user}/g, member.toString())
                .replace(/{username}/g, member. user?. username || interaction.user.username)
                .replace(/{tag}/g, member. user?.tag || interaction.user.tag)
                .replace(/{server}/g, interaction.guild. name)
                .replace(/{memberCount}/g, interaction.guild.memberCount. toString())
                .replace(/{count}/g, interaction.guild.memberCount. toString());
        };

        // --- HANDLERS ---
        if (subcommand === 'channel') {
            const ch = interaction.options. getChannel('target');
            await updateSetting('channelId', ch. id);
            return interaction.editReply({ content: `✅ Welcome channel set to ${ch}` });
        }

        if (subcommand === 'message') {
            const msg = interaction.options.getString('content');
            await updateSetting('message', msg);
            return interaction.editReply({ content: `✅ Message updated to: ${msg}` });
        }

        if (subcommand === 'dm') {
            const enabled = interaction.options. getBoolean('enabled');
            await updateSetting('dmEnabled', enabled);

            let dmNote = '';
            if (enabled) {
                try {
                    const s = db.get(guildId);
                    const e = s.embed || {};

                    const embed = new EmbedBuilder()
                        .setColor(e.color || CONFIG. defaultColor)
                        .setTitle(parseText(e.title || 'Welcome! '))
                        . setDescription(parseText(s.message || 'Welcome {user} to {server}!'))
                        .setTimestamp();

                    if (e. thumbnail) {
                        embed.setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));
                    }
                    if (e.image) {
                        embed.setImage(e.image);
                    }
                    if (e.footer) {
                        embed.setFooter({ text: parseText(e.footer) });
                    }

                    await interaction. user.send({ embeds: [embed] });
                    dmNote = ' Test DM sent!';
                } catch (err) {
                    console.warn('[dm-preview] Failed:', err?. code || err?.message);
                    dmNote = ' (⚠️ Could not send test DM - check your privacy settings)';
                }
            }

            return interaction.editReply({ content: `✅ DM Welcome is now **${enabled ?  'ON' : 'OFF'}**. ${dmNote}` });
        }

        if (subcommand === 'autorole') {
            const role = interaction. options.getRole('role');
            if (role) {
                const me = interaction.guild.members.me || await interaction.guild.members.fetchMe();
                if (role.position >= me.roles.highest.position) {
                    return interaction.editReply({ content: '❌ I cannot assign this role - it is higher than or equal to my highest role.' });
                }
                await updateSetting('autorole', role.id);
                return interaction.editReply({ content: `✅ Autorole set to **${role.name}**. ` });
            } else {
                await updateSetting('autorole', null);
                return interaction.editReply({ content:  `✅ Autorole disabled.` });
            }
        }

        if (subcommand === 'ping') {
            const enabled = interaction.options.getBoolean('enabled');
            await updateSetting('ping', enabled);
            return interaction.editReply({ content: `✅ User ping is now **${enabled ? 'ON' : 'OFF'}**.` });
        }

        // --- Embed Group ---
        if (subcommandGroup === 'embed') {
            if (subcommand === 'color') {
                let hex = interaction.options.getString('hex');
                if (! hex.startsWith('#')) hex = '#' + hex;
                if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    return interaction.editReply({ content: '❌ Invalid Hex Code. Use format: #FF0000' });
                }
                await updateEmbed('color', hex. toUpperCase());
                return interaction.editReply({ 
                    embeds: [new EmbedBuilder().setColor(hex).setDescription(`✅ Embed color set to \`${hex}\``)] 
                });
            }
            if (subcommand === 'title') {
                const text = interaction.options.getString('text');
                await updateEmbed('title', text);
                return interaction.editReply({ content: `✅ Embed title updated to:  ${text}` });
            }
            if (subcommand === 'image') {
                const url = interaction.options. getString('url');
                // Basic URL validation
                if (! url.startsWith('http://') && !url.startsWith('https://')) {
                    return interaction.editReply({ content: '❌ Invalid URL.  Must start with http:// or https://' });
                }
                await updateEmbed('image', url);
                return interaction.editReply({ content: `✅ Embed image updated. ` });
            }
            if (subcommand === 'thumbnail') {
                const show = interaction.options. getBoolean('show');
                await updateEmbed('thumbnail', show);
                return interaction.editReply({ content: `✅ Thumbnail is now **${show ? 'ON' : 'OFF'}**.` });
            }
            if (subcommand === 'footer') {
                const text = interaction.options. getString('text');
                await updateEmbed('footer', text);
                return interaction. editReply({ content: `✅ Embed footer updated to: ${text}` });
            }
        }

        if (subcommand === 'status') {
            const s = db.get(guildId);
            const e = s.embed || {};
            const embed = new EmbedBuilder()
                .setColor(e. color || CONFIG.defaultColor)
                .setTitle('⚙️ Welcome Configuration')
                .addFields(
                    { name: '📢 Channel', value: s.channelId ?  `<#${s.channelId}>` : '❌ Not Set', inline: true },
                    { name: '🎭 Autorole', value: s.autorole ? `<@&${s.autorole}>` : '❌ Disabled', inline: true },
                    { name: '📬 DM', value: s.dmEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name:  '🔔 Ping', value:  s.ping ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '📝 Title', value: e. title || 'Welcome!', inline: true },
                    { name: '📄 Footer', value: e. footer || 'Member #{count}', inline: true },
                    { name: '💬 Message', value: s.message || 'Welcome {user} to {server}!', inline: false }
                )
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'test') {
            const s = db.get(guildId);
            if (!s.channelId && !s.dmEnabled) {
                return interaction.editReply({ content: '❌ Please set a channel or enable DM first!' });
            }
            await interaction.editReply({ content: '🔄 Simulating welcome event...' });
            
            // Emit the event
            interaction.client.emit(Events.GuildMemberAdd, interaction.member);
            
            setTimeout(async () => {
                await interaction.followUp({
                    content:  '✅ Test complete! Check the welcome channel and/or your DMs.',
                    ephemeral: true
                });
            }, 1000);
        }
    }
};
commands.set(welcomeCommand.data. name, welcomeCommand);

// ==========================================
// 4. CLIENT & EVENTS
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// Logging events
client.on(Events. Warn, (msg) => console.warn('[discord: warn]', msg));
client.on(Events.Error, (err) => console.error('[discord:error]', err));
client.on(Events. Debug, (msg) => {
    // Only log important debug messages
    if (msg.includes('Heartbeat') || msg.includes('Session')) {
        console.log('[discord:debug]', msg);
    }
});

// --- EVENT:  READY ---
client. once(Events.ClientReady, async (c) => {
    console.log(`✅ Ready! Logged in as ${c.user. tag}`);
    console.log(`📊 Serving ${c.guilds.cache.size} guilds`);

    // Register Commands
    const rest = new REST({ version: '10' }).setToken(CONFIG.token);
    const commandData = Array.from(commands. values()).map(cmd => cmd.data. toJSON());

    try {
        console.log(`[commands] Refreshing ${commandData. length} slash commands...`);
        await rest.put(
            Routes. applicationCommands(c.user.id),
            { body:  commandData }
        );
        console.log(`[commands] ✅ Successfully registered slash commands`);
    } catch (error) {
        console.error('[commands] ❌ Failed to register:', error);
    }
});

// --- EVENT: INTERACTION CREATE ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (! interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) {
        console.warn(`[interaction] Unknown command: ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        if (error. code === 10062) {
            console.warn(`[interaction] Expired:  ${interaction.id}`);
            return;
        }

        console.error(`[interaction] Error in ${interaction.commandName}:`, error);
        
        const errorMessage = { content: '❌ An error occurred while executing this command. ', ephemeral: true };
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (e) {
            console.error('[interaction] Could not send error message:', e. message);
        }
    }
});

// --- EVENT:  GUILD MEMBER ADD ---
client.on(Events.GuildMemberAdd, async (member) => {
    const guildId = member.guild.id;
    const settings = db.get(guildId);

    if (!settings) return;
    if (! settings.channelId && !settings.dmEnabled) return;

    console.log(`[welcome] New member:  ${member.user. tag} in ${member.guild.name}`);

    // Defaults
    const s = {
        ... settings,
        embed: settings.embed || { color: CONFIG.defaultColor, title: "Welcome!", thumbnail: true }
    };

    // --- AUTOROLE ---
    if (s.autorole) {
        try {
            const role = member.guild.roles. cache.get(s.autorole);
            if (role) {
                await member.roles.add(role);
                console.log(`[autorole] Assigned ${role.name} to ${member.user. tag}`);
            } else {
                console.warn(`[autorole] Role ${s.autorole} not found`);
            }
        } catch (err) {
            console.error(`[autorole] Failed: `, err.message);
        }
    }

    // --- TEXT PARSING ---
    const parseText = (text) => {
        if (!text) return "";
        return text
            .replace(/{user}/g, member.toString())
            .replace(/{username}/g, member. user. username)
            .replace(/{tag}/g, member.user.tag)
            .replace(/{server}/g, member.guild. name)
            .replace(/{memberCount}/g, member. guild.memberCount. toString())
            .replace(/{count}/g, member.guild.memberCount. toString());
    };

    // --- BUILD EMBED ---
    const embed = new EmbedBuilder()
        .setColor(s.embed. color || CONFIG.defaultColor)
        .setTitle(parseText(s.embed. title || "Welcome!"))
        .setDescription(parseText(s.message || "Welcome {user} to {server}!"))
        .setTimestamp();

    if (s.embed. thumbnail) {
        embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
    }
    if (s. embed.image) {
        embed.setImage(s.embed.image);
    }
    if (s.embed.footer) {
        embed.setFooter({ text: parseText(s.embed.footer) });
    }

    // --- SEND MESSAGES ---
    const tasks = [];

    // DM
    if (s.dmEnabled) {
        tasks. push(
            member.send({ embeds: [embed] })
                .then(() => console.log(`[welcome: dm] Sent to ${member.user. tag}`))
                .catch((err) => console.warn(`[welcome:dm] Failed for ${member.user. tag}:`, err.message))
        );
    }

    // Channel
    if (s.channelId) {
        let channel = member.guild.channels.cache. get(s.channelId);
        if (!channel) {
            try {
                channel = await member.guild.channels.fetch(s. channelId);
            } catch (err) {
                console. error(`[welcome:channel] Could not fetch ${s.channelId}:`, err.message);
            }
        }

        if (channel) {
            const payload = { embeds: [embed] };
            if (s.ping) {
                payload.content = member.toString();
            }
            tasks. push(
                channel.send(payload)
                    .then(() => console.log(`[welcome:channel] Sent in #${channel.name}`))
                    . catch((err) => console.error(`[welcome:channel] Failed: `, err.message))
            );
        }
    }

    await Promise.allSettled(tasks);
});

// ==========================================
// 5. HTTP SERVER (Keep-Alive for Render)
// ==========================================
const server = http.createServer((req, res) => {
    const status = client.isReady() ? 'online' : 'connecting';
    res. writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status:  status,
        uptime: process.uptime(),
        guilds: client.guilds?. cache?.size || 0
    }));
});

const PORT = process.env.PORT || 3000;
server. listen(PORT, '0.0.0.0', () => {
    console. log(`[http] Health check server on port ${PORT}`);
});

// ==========================================
// 6. GRACEFUL SHUTDOWN
// ==========================================
const shutdown = (signal) => {
    console.log(`\n[shutdown] Received ${signal}, shutting down...`);
    client.destroy();
    server.close(() => {
        console. log('[shutdown] HTTP server closed');
        process.exit(0);
    });
    // Force exit after 5 seconds
    setTimeout(() => process.exit(0), 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ==========================================
// 7. LOGIN
// ==========================================
console.log('[discord] Attempting login...');

client.login(CONFIG. token)
    .then(() => {
        console.log('[discord] ✅ Login successful, waiting for READY event...');
    })
    .catch(err => {
        console.error('[discord] ❌ Login failed:', err. message);
        if (err.code === 'TokenInvalid') {
            console.error('[discord] Your bot token is invalid. Please check your . env file.');
        }
        if (err.code === 'DisallowedIntents') {
            console. error('[discord] You need to enable "Server Members Intent" in Discord Developer Portal.');
        }
        process.exit(1);
    });
