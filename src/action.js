const { 
    inlineCode,
    codeBlock,
    EmbedBuilder 
} = require('discord.js')
const { format_tabular_data } = require("./util/interactive_component.js")
const discord_client = require('./discord_client.js')

const ViolationType = {
    banned_term: "Use of Banned Term"
}

function warn_user(guild, user, violation_type, payload) {
    const warning_embed = new EmbedBuilder()
        .setTitle(`Warning from ${inlineCode(guild.name)}`)
        .setColor('Red')
        .setDescription(`Reason: ${inlineCode(violation_type)}`)
        .setAuthor({ name: discord_client.user.displayName, iconURL: discord_client.user.displayAvatarURL() });

    switch (violation_type) {
        case ViolationType.banned_term:
            const { original_message, used_banned_terms } = payload;

            warning_embed.addFields(
                { name: 'Your Message:', value: codeBlock(original_message) },
                { name: 'Analysis:', value: format_tabular_data(['Banned Term', 'Times Used'], used_banned_terms) }
            );

            break;
        default:
            throw new Error(`Unsupported Violation Type: ${violation_type}`);
    }

    user.send({ embeds: [warning_embed] });
}

module.exports = {
    ViolationType,
    warn_user
}