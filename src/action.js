const { name } = require('../package.json')
const { 
    inlineCode,
    codeBlock,
    EmbedBuilder 
} = require('discord.js')
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

            // Build a table-like string
            let table = "Banned Term      | Times Used\n";
            table += "-----------------|-----------\n";

            used_banned_terms.forEach(([term, count]) => {
                // Pad the banned term column to align
                const paddedTerm = term.padEnd(16, " ");
                table += `${paddedTerm} | ${count}\n`;
            });

            warning_embed.addFields(
                { name: 'Your Message:', value: codeBlock(original_message || '') },
                { name: 'Analysis:', value: codeBlock(table) }
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