// Warning: Bug in Existing Implementation
const cfg = require('../../config.json')
const Stack = require('./stack')

const get_ascii_index = (c) => { return c.charCodeAt(0) }

module.exports = class SuffixTree{
    constructor(text){
        this.text = text
        this.root_node = new Node(null, null, false)

        this.active_node = this.root_node
        this.active_edge = null
        this.active_length = 0
        this.global_end = new GlobalEnd()
        this.size = 1

        this.construct_with_ukkonen()
        this.set_suffix_id()
    }

    traverse(node){
        if (this.active_length >= node.get_edge_length()){
            this.active_node = node
            this.active_edge += node.get_edge_length()
            this.active_length -= node.get_edge_length()
            return true
        }
        return false
    }

    construct_with_ukkonen(){
        let j = 0
        for (let i = 0; i < this.text.length; i++){
            this.global_end.increment()
            let previous_internal_node = null
            while (j <= i){
                if (this.active_length == 0){
                    this.active_edge = i
                }
                if (this.active_node.get_child_node(get_ascii_index(this.text[this.active_edge])) == null){
                    const new_node = new Node(i, this.global_end)
                    this.active_node.set_child_node(get_ascii_index(this.text[this.active_edge]), new_node)
                    this.size+=1
                    if (previous_internal_node != null){
                        previous_internal_node.suffix_link = this.active_node
                        previous_internal_node = null
                    }
                } else {
                    const current_edge_node = this.active_node.get_child_node(get_ascii_index(this.text[this.active_edge]))
                    if (this.traverse(current_edge_node)){
                        continue
                    } 
                    if (this.text[i] == this.text[current_edge_node.start + this.active_length]){
                        if (previous_internal_node != null && this.active_node != this.root_node){
                            previous_internal_node.suffix_link = this.active_node
                            previous_internal_node = null
                        }
                        this.active_length+=1
                        break
                    } else {
                        const prev_start = current_edge_node.start
                        current_edge_node.start += this.active_length
                        const internal_node = new Node(prev_start, prev_start+this.active_length-1, false)
                        const leaf_node = new Node(i, this.global_end)
                        this.active_node.set_child_node(get_ascii_index(this.text[internal_node.start]), internal_node)
                        internal_node.set_child_node(get_ascii_index(this.text[leaf_node.start]), leaf_node)
                        internal_node.set_child_node(get_ascii_index(this.text[current_edge_node.start]), current_edge_node)
                        this.size += 2
                        if (previous_internal_node != null){
                            previous_internal_node.suffix_link = internal_node
                        }
                        internal_node.suffix_link = this.root_node
                        previous_internal_node = internal_node
                    }
                }
                j+=1
                if(this.active_node == this.root_node && this.active_length > 0){
                    this.active_length -= 1
                    this.active_edge = j - (i-j+1) + 1
                } else if (this.active_node != this.root_node) {
                    this.active_node = this.active_node.suffix_link
                }
            }
        }
    }

    set_suffix_id(){
        const stack = new Stack(this.size)
        stack.push([this.root_node, 0])
        while (!stack.is_empty()){
            let [node, path_length] = stack.pop()
            if (node != this.root_node){
                path_length += node.get_edge_length()
            }
            if (node.is_leaf){
                node.suffix_id = this.text.length - path_length + 1
            }
            for(let i=node.child_node.length-1; i>=0; i--){
                if(node.child_node[i] != null){
                    stack.push([node.child_node[i], path_length])
                }
            }
        }

    }

    get_suffix_array(){
        const suffix_arr = []
        const stack = new Stack(this.size)
        stack.push(this.root_node)
        while (!stack.is_empty()){
            const node = stack.pop()
            if(node.is_leaf){
                suffix_arr.push(node.suffix_id)
            }
            for(let i = node.child_node.length-1; i >= 0; i--){
                if (node.child_node[i] != null){
                    stack.push(node.child_node[i])
                }
            }
        }
        return suffix_arr
    }
}

class Node{
    constructor(start=null, end=null, is_leaf=true){
        this.suffix_id = null
        this.start = start
        this.end = end
        this.is_leaf = is_leaf
        this.child_node = new Array(cfg.ascii_ubound - cfg.ascii_lbound + 1).fill(null)
        this.suffix_link = null
    }

    get_child_node(index){
        return this.child_node[index]
    }

    set_child_node(index, node){
        this.child_node[index] = node 
    }

    get_end_value(){
        if (this.is_leaf){
            return this.end.get_value()
        } else {
            return this.end
        }
    }

    get_edge_length(){
        return this.get_end_value() - this.start + 1
    }

}

class GlobalEnd{
    constructor(){
        this.value = 0
    }

    set_value(value){
        this.value = value
    }

    get_value(){
        return this.value
    }

    increment() {
        this.set_value(this.get_value()+1)
    }
}