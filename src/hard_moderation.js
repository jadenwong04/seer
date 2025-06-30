const SuffixTree = require('@jayrbolton/suffix-tree')
const math = require('mathjs')
const cfg = require('../config.json')
const { EmbedBuilder } = require('discord.js')

const get_ascii_index = (c) => { return c.charCodeAt(0) }
const get_hex_value = (d) => { return '0x' + d.toString(16).padStart(6, '0') }

function get_suffix_array(suffix_tree){
    suffix_length_array = []
    dfs(suffix_tree.root, 0, suffix_tree.text.length, suffix_length_array)
    return suffix_length_array.map(length => suffix_tree.text.length - length + 1)
}

function dfs(current_node, counter, length_of_text, result){
    Object.keys(current_node.children).sort().forEach(child_node_char => {
        child_node = current_node.children[child_node_char]
        if (child_node.end == undefined) {
            result.push(counter + length_of_text - child_node.start)
        } else {
            dfs(child_node, counter + child_node.end - child_node.start + 1, length_of_text, result)
        }
    })
}

function get_bwt(msg){
    const bwt_msg = msg + '$'
    const suffix_arr = get_suffix_array(SuffixTree.create(msg))
    return [suffix_arr.map(id => bwt_msg[math.mod((id-2), bwt_msg.length)]).join(''), suffix_arr]
}

function get_rank_arr(bwt){
    const rank_arr = Array(cfg.ascii_ubound - cfg.ascii_lbound + 1).fill(0)
    Array.from(bwt).forEach(char => rank_arr[get_ascii_index(char)] += 1)
    let counter = 1
    for (let i = 0; i < rank_arr.length; i++){
        if (rank_arr[i] > 0){
            const prev = rank_arr[i]
            rank_arr[i] = counter
            counter += prev
        }
    }
    return rank_arr
}

function get_occurrence_arr(bwt){
    const occ_arr = Array(bwt.length+1).fill().map(() => Array(cfg.ascii_ubound - cfg.ascii_lbound + 1).fill(0))
    for (let i = 1; i < bwt.length+1; i++){
        for (let j = 0; j < cfg.ascii_ubound - cfg.ascii_lbound + 1; j++){
            occ_arr[i][j] = occ_arr[i-1][j]
        }
        occ_arr[i][get_ascii_index(bwt[i-1])] += 1
    }
    return occ_arr
}

function exact_pattern_match(message_content, patterns){ 
    const [bwt, suffix_arr] = get_bwt(message_content)
    const rank_arr = get_rank_arr(bwt)
    const occurrence_arr = get_occurrence_arr(bwt)
    const result = new Map()
    patterns.forEach(pattern => {
        let sp = 1
        let ep = bwt.length 
        let i = pattern.length
        while (i >= 1 && sp <= ep){
            const rank = rank_arr[get_ascii_index(pattern[i-1])]
            sp = rank + occurrence_arr[sp-1][get_ascii_index(pattern[i-1])]
            ep = rank + occurrence_arr[ep][get_ascii_index(pattern[i-1])] - 1
            i -= 1
        }
        const position = suffix_arr.slice(sp-1, ep)
        if (position.length > 0) result.set(pattern, position)
    })
    return result
}

function approximate_pattern_match(message_content, patterns){

}

async function hard_moderation(message_id, guild_id, message_content){
    const exact_pattern_match_result = exact_pattern_match(msg, gid)
    const approximate_pattern_match_result = null
    if (contains_profanity && sentiment_score < cfg.sentimentThreshold || text_filter.size > 0){
        const format_instruction = Array.from(text_filter.entries(), ([pat, pos]) => {
            return pos.map(p => [p-1, p+pat.length-2])
        }).flat()
        format_instruction.sort((a, b) => b[0]-a[0])
        const ansi_start = `[0;${cfg.ansi_bg}m`
        const ansi_end = `[0m`
        format_instruction.forEach(([start, end]) => {
            const before = msg.substring(0, start)
            const substring = msg.substring(start, end+1)
            const after = msg.substring(end+1, msg.length)
            const formatted_substring = ansi_start + substring + ansi_end
            msg = before + formatted_substring + after
        })
        msg = "```ansi\n" + msg + "\n```"
        return mod_embed_msg_builder(id, gid, profanityFilter.clean(msg), sentiment_score, cfg.timeoutDuration * (Math.abs(Number(contains_profanity)*(Math.round(sentiment_score))) + text_filter.size))
    }
    return null;
}

function mod_embed_msg_builder(id, gid, description, sentiment_score, timeout_duration){
    return new EmbedBuilder()
        .setColor(Number(get_hex_value(cfg.mod_embed_color)))
        .setTitle("Moderation Result for msg `" + id + "` in guild `" + gid + "`")
        .setDescription(description)
        .addFields(
            { name: 'Sentiment Score', value: `${sentiment_score}`, inline: true },
            { name: 'Timeout Duration', value: `${timeout_duration / 1000} seconds`, inline: true },
        )
        .setFooter({ text:"Highlighted substring represents restricted keyword and '*' represents profanity." })
}

module.exports = hard_moderation

