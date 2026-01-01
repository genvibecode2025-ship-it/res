const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');
const config = require('../config');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const guildId = member.guild.id;
        const settings = db.get(guildId);

        // If no settings or no channel configured, do nothing
        if (!settings || !settings.channelId) return;

        // Ensure defaults for robust error handling
        const s = {
            ...settings,
            embed: settings.embed || { color: config.defaultColor, title: "Welcome!", thumbnail: true }
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
        // Helper function for placeholders
        const parseText = (text) => {
            if (!text) return "";
            return text
                .replace(/{user}/g, member.toString())
                .replace(/{username}/g, member.user.username)
                .replace(/{tag}/g, member.user.tag)
                .replace(/{server}/g, member.guild.name)
                .replace(/{memberCount}/g, member.guild.memberCount)
                .replace(/{count}/g, member.guild.memberCount); // Alias
        };

        const description = parseText(s.message || "Welcome {user} to {server}!");
        const title = parseText(s.embed.title);
        const footer = parseText(s.embed.footer);

        // --- EMBED CONSTRUCTION ---
        const embed = new EmbedBuilder()
            .setColor(s.embed.color || config.defaultColor)
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
                
                // Add Ping if enabled
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
                // Ignore DM errors (common if user has DMs closed)
            }
        }
    },
};
