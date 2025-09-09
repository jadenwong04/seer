const SuffixTree = require('@jayrbolton/suffix-tree')
const cfg = require('../config.json')
const natural = require("natural")
const word_bank = require('wordlist-english')['english']
const tokenizer = new natural.WordTokenizer();
const word_dict = new Set(word_bank.map(word => word.toLowerCase()))

const get_ascii_index = (c) => { return c.charCodeAt(0) }

module.exports = (message_content, lookout_terms) => {
    const tokenized_message = tokenizer.tokenize(message_content)
    const joined_tokenized_message = tokenized_message.join("")

    let length_acc = 0
    const tokenized_intervals = []
    for (token of tokenized_message) {
        tokenized_intervals.push([length_acc + 1, length_acc + token.length])
        length_acc += token.length
    }

    const lookout_violations = new Map()
    
    lookout_terms.map(lookout_term => {
        const [term, offset] = lookout_term.split(":")
        return [term, Number(offset)]
    }).forEach(([term, offset]) => {
        const exact_matches = exact_pattern_match(joined_tokenized_message, term)
        const approximate_matches = approximate_pattern_match(joined_tokenized_message, term, offset, tokenized_message, tokenized_intervals)
        lookout_violations.set(term, exact_matches.length + approximate_matches.length)
    })

    return lookout_violations
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
    const suffix_arr = get_suffix_array(SuffixTree.create(bwt))
    return [suffix_arr.map(id => bwt[(id - 2 + bwt.length) % bwt.length]).join(''), suffix_arr]
}

function get_rank_arr(bwt){
    const rank_arr = Array(cfg.pattern_match_ascii.ubound - cfg.pattern_match_ascii.lbound + 1).fill(0)
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
    const occ_arr = Array(bwt.length+1).fill().map(() => Array(cfg.pattern_match_ascii.ubound - cfg.pattern_match_ascii.lbound + 1).fill(0))
    for (let i = 1; i < bwt.length+1; i++){
        for (let j = 0; j < cfg.pattern_match_ascii.ubound - cfg.pattern_match_ascii.lbound + 1; j++){
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

function partition_pattern(pattern, max_edit_distance) {
    const partitions = new Array(max_edit_distance + 1)
    const offsets = new Array(max_edit_distance + 1)
    const partition_size = Math.ceil(pattern.length / (max_edit_distance + 1))

    let s_p, e_p
    for (let pid = 0; pid < partitions.length; pid++) {
        s_p = pid * partition_size
        if (s_p + partition_size > pattern.length) {
            e_p = pattern.length
        } else {
            e_p = s_p + partition_size
        }
        partitions[pid] = pattern.slice(s_p, e_p)
        offsets[pid] = s_p
    }

    return { partitioned_pattern: partitions, partitioned_offsets: offsets }
}

function get_edit_distance(tokenized_content, pattern) {
    const rows = tokenized_content.length + 1;
    const cols = pattern.length + 1;

    const edit_distance_matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let j = 0; j < cols; j++) {
        edit_distance_matrix[0][j] = j;
    }

    for (let i = 0; i < rows; i++) {
        edit_distance_matrix[i][0] = 0;
    }

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            if (tokenized_content[i - 1] === pattern[j - 1]) {
                edit_distance_matrix[i][j] = edit_distance_matrix[i - 1][j - 1];
            } else {
                edit_distance_matrix[i][j] = Math.min(
                    edit_distance_matrix[i][j - 1] + 1, 
                    edit_distance_matrix[i - 1][j],        
                    edit_distance_matrix[i - 1][j - 1] + 1  
                );
            }
        }
    }

    return edit_distance_matrix[rows - 1][cols - 1];
}

function exact_pattern_match (message_content, pattern) {
    return bwt_pattern_match(message_content, pattern)
}

function approximate_pattern_match (
    message_content,
    pattern,
    pattern_edit_distance,
    tokenized_message,
    tokenized_intervals
) {
    const { partitioned_pattern, partitioned_offsets } = partition_pattern(pattern, pattern_edit_distance)

    const partitioned_matches = partitioned_pattern.map((partition, partition_id) => {
        const matches = bwt_pattern_match(message_content, partition)
        return [partition_id, matches]
    });

    const sp_count = new Map()

    partitioned_matches.forEach(([partition_id, matches]) => {
        matches.forEach(position => {
            const sp_position = Math.max(position - partitioned_offsets[partition_id], 1)
            if (!sp_count.has(sp_position)) {
                sp_count.set(sp_position, 1)
            } else {
                sp_count.set(sp_position, sp_count.get(sp_position) + 1)
            }
        })
    })

    const approximate_positions = new Set()

    partitioned_matches.forEach(([partition_id, matches]) => {
        matches
            .filter(position => sp_count.get(Math.max(position - partitioned_offsets[partition_id], 1)) < partitioned_pattern.length) //filter non exact matches
            .filter(position => !word_dict.has(tokenized_message[binary_search_interval(tokenized_intervals, position)].toLowerCase())) //filter typos 
            .forEach(position => approximate_positions.add(Math.max(position - partitioned_offsets[partition_id], 1)))
    })

    const approximate_matches = Array.from(approximate_positions)
        .map(position => ({ sp: position, ep: position + pattern.length - 1 }))
        .filter(({sp, ep}) => get_edit_distance(message_content.slice(sp-1, ep), pattern) <= pattern_edit_distance)

    return approximate_matches
}

function binary_search_interval(tokenized_intervals, target) {
    lo = 0
    hi = tokenized_intervals.length - 1
    while (lo <= hi) {
        mid = Math.floor((lo + hi) / 2)
        if (target >= tokenized_intervals[mid][0] && target <= tokenized_intervals[mid][1]) {
            return mid 
        } else if (target < tokenized_intervals[mid][0]) {
            hi = mid - 1
        } else if (target > tokenized_intervals[mid][1]) {
            lo = mid + 1
        }
    }
}