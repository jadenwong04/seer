const { 
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ComponentType
} = require("discord.js")

function build_paging_component() {
    const next_btn = new ButtonBuilder()
        .setCustomId("next")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("▶️")

    const prev_btn = new ButtonBuilder()
        .setCustomId("prev")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("◀️")
    
    const paging_components = new ActionRowBuilder()
        .addComponents(prev_btn, next_btn)
    
    return paging_components
}

function build_listing_embed(
    listing_config,
    paging_data,
    current_page
) {
    const start_paging_idx = (current_page-1) * listing_config.page_size
    const end_paging_idx = start_paging_idx + listing_config.page_size 
    const current_page_data = paging_data.slice(start_paging_idx, end_paging_idx)

    const embedded_page = new EmbedBuilder()
        .setColor(listing_config.color)
        .setTitle(listing_config.title)
        .addFields(...current_page_data)
        .setFooter({ text: `Page: ${current_page}/${Math.ceil(paging_data.length / listing_config.page_size)}`})
        .setTimestamp()
    
    return embedded_page
}

function setup_paging_collector(
    interaction_to_update,
    paging_component_response,
    interaction_interval,
    paging_data,
    listing_config
) {
    const max_page = Math.ceil(paging_data.length / listing_config.page_size)
    let current_page = 1

    const paging_collector = paging_component_response.resource.message.createMessageComponentCollector(
        { 
            componentType: ComponentType.Button,
            time: interaction_interval 
        }
    )

    const interaction_update = () => {
        const updated_listing_embed = build_listing_embed(
            listing_config,
            paging_data,
            current_page
        )

        interaction_to_update.editReply({ embeds: [updated_listing_embed] });
    }

    paging_collector.on('collect', async (component_interaction) => {
        if (component_interaction.customId == "next") {
            if (current_page < max_page) {
                current_page += 1
                interaction_update()
            }
        } else if (component_interaction.customId == "prev") {
            if (current_page > 1) {
                current_page -= 1
                interaction_update()
            }
        }
        component_interaction.deferUpdate();
    })
}

module.exports = {
    build_paging_component,
    build_listing_embed,
    setup_paging_collector
}