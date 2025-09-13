import { 
    Guild,
    GuildBasedChannel,
    User,
    Message,
    inlineCode,
    codeBlock,
    EmbedBuilder
} from "discord.js"
import {
    format_tabular_data
} from "./util/interactive_component.js"
import discord_client from "./discord_client.js"

abstract class Violation {
    name: string
    description: string
    user: User
    guild: Guild

    constructor(
        name: string,
        description: string,
        user: User,
        guild: Guild
    ) {
        this.name = name
        this.description = description
        this.user = user
        this.guild = guild
    }

    warn(additional_fields: Array<[string, string]>): void {
        const warning_embed = this.get_warning_embed_template()
        warning_embed.addFields(
            ...(additional_fields.map(([field_name, field_value]) => ({
                name: field_name,
                value: field_value
            })))
        )
        this.user.send({ embeds: [warning_embed] })
    }

    // timeout(): void

    // kick(): void

    // ban(): void

    get_warning_embed_template(): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle(`Warning from ${inlineCode(this.guild.name)}`)
            .setColor('Red')
            .setDescription(`Category: ${inlineCode(this.name)}`)
            .addFields(
                { 
                    name: "Reason:",
                    value: codeBlock(this.description)
                }
            )
            .setAuthor(
                { 
                    name: discord_client.user.displayName,
                    iconURL: discord_client.user.displayAvatarURL() 
                }
            );
    }
}

class BannedTerm extends Violation {
    message: Message
    channel: GuildBasedChannel
    used_banned_term: Map<string, number>

    constructor(
        user: User,
        guild: Guild,
        channel: GuildBasedChannel,
        message: Message,
        used_banned_term: Map<string, number>
    ) {
        super("Banned Term", "Use of Banned Term in Message.", user, guild)
        this.message = message
        this.channel = channel
        this.used_banned_term = used_banned_term
    }

    warn(): void {
        super.warn(
            [
                ['Your Message:', codeBlock(this.message.content)],
                ['From Channel:', codeBlock(this.channel.name)],
                ['Banned Term Analysis:', format_tabular_data(['Banned Term', 'Times Used'], Array.from(this.used_banned_term.entries()).filter(([_, value]) => value > 0))]
            ]
        )
    }
}

// class BannedLink extends Violation {

// }

// class Spam extends Violation {

// }

// class OffenceCount extends Violation {

// }

// class CustomViolation extends Violation {

// }

export { BannedTerm }