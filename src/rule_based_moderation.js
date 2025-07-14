const SuffixTree = require('@jayrbolton/suffix-tree')
const cfg = require('../config.json')
const { EmbedBuilder } = require('discord.js')

const get_ascii_index = (c) => { return c.charCodeAt(0) }
const get_hex_value = (d) => { return '0x' + d.toString(16).padStart(6, '0') }

module.exports = async (message_id, guild_id, message_content) => {
    
}

function get_suffix_array(suffix_tree){
    const suffix_length_array = []
    dfs(suffix_tree.root, 0, suffix_tree.text.length, suffix_length_array)
    return suffix_length_array.map(length => suffix_tree.text.length - length + 1)
}

function dfs(current_node, counter, length_of_text, result){
    Object.keys(current_node.children).sort().forEach(child_node_char => {
        const child_node = current_node.children[child_node_char]
        if (child_node.end == undefined) {
            result.push(counter + length_of_text - child_node.start)
        } else {
            dfs(child_node, counter + child_node.end - child_node.start + 1, length_of_text, result)
        }
    })
}

function get_bwt(message_content){
    const bwt = message_content + '$'
    const suffix_arr = get_suffix_array(SuffixTree.create(message_content))
    return [suffix_arr.map(id => bwt[(id - 2 + bwt.length) % bwt.length]).join(''), suffix_arr]
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

function bwt_pattern_match(message_content, pattern){
    const [bwt, suffix_arr] = get_bwt(message_content)
    const rank_arr = get_rank_arr(bwt)
    const occurrence_arr = get_occurrence_arr(bwt)

    let sp = 1
    let ep = bwt.length 
    let i = pattern.length
    while (i >= 1 && sp <= ep){
        const rank = rank_arr[get_ascii_index(pattern[i-1])]
        sp = rank + occurrence_arr[sp-1][get_ascii_index(pattern[i-1])]
        ep = rank + occurrence_arr[ep][get_ascii_index(pattern[i-1])] - 1
        i -= 1
    }

    return suffix_arr.slice(sp-1, ep)
}

function partition_pattern(pattern, max_edit_distance){
    const partitions = new Array(max_edit_distance + 1)
    const partition_size = Math.ceil(pattern.length / (max_edit_distance + 1))
    let s_p, e_p
    for (let pid = 0; pid < partitions.length; pid++){
        s_p = pid * partition_size
        if (s_p + partition_size > pattern.length){
            e_p = pattern.length
        } else {
            e_p = s_p + partition_size
        }
        partitions[pid] = pattern.slice(s_p, e_p)
    }
    return partitions
}

function get_edit_distance(tokenized_content, pattern){
    const rows = tokenized_content.length + 1;
    const cols = pattern.length + 1;

    const edit_distance_matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = 0; i < rows; i++) {
        edit_distance_matrix[i][0] = i;
    }

    for (let j = 0; j < cols; j++) {
        edit_distance_matrix[0][j] = j;
    }

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            if (tokenized_content[i - 1] === pattern[j - 1]) {
                edit_distance_matrix[i][j] = edit_distance_matrix[i - 1][j - 1];
            } else {
                edit_distance_matrix[i][j] = 1 + Math.min(
                    edit_distance_matrix[i][j - 1],    
                    edit_distance_matrix[i - 1][j],    
                    edit_distance_matrix[i - 1][j - 1]
                )
            }
        }
    }

    return edit_distance_matrix[rows - 1][cols - 1];
}


function pattern_match(message_content, pattern, pattern_edit_distance){
    const partitioned = partition_pattern(pattern, pattern_edit_distance)

    const tokenized_positions = [... new Set(partitioned.flatMap((partition, partition_id) => {
        const matches = bwt_pattern_match(message_content, pattern)
        return matches.map(position => position - (partition_id * partitioned.length))
    }))];

    const filtered_tokenized_positions = tokenized_positions.filter(position => position >= 1 && (position + pattern.length - 1) - pattern_edit_distance <= message_content.length)

    const position_count = new Map()

    filtered_tokenized_positions.forEach(position => {
        if (position_count.get(position) === null) {
            position_count.set(position, 1)
        } else {
            position_count.set(position, position_count.get(position) + 1)
        }
    })

    const exact_match_result = []
    const approximate_match_positions = []

    for (const [position, count] of position_count){
        if (count === partitioned.length) {
            exact_match_result.push(position)
        } else {
            approximate_match_positions.push(position)
        }
    }

    const approximate_match_result = approximate_match_positions.map(position => {
        s_p = position - 1
        e_p = s_p + pattern.length
        if (e_p > message_content.length) {
            e_p = message_content.length
        }
        return [s_p, e_p]
    }).map(([s_p, e_p]) => get_edit_distance(message_content.slice(s_p, e_p), pattern)).filter(edit_distance => edit_distance <= pattern_edit_distance)

    return [exact_match_result, approximate_match_result]
}

async function rule_based_moderation(message_id, guild_id, message_content){
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