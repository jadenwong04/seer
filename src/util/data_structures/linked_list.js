module.exports = class LinkedList {
    constructor(){
        this.head = null
        this.tail = null
        this.size = 0
    }

    add(id, data){
        const new_node = new Node(id, data)
        if (this.head == null){
            this.head = new_node
            this.tail = new_node
        } else {
            this.tail.next = new_node
            this.tail = new_node
        }
        this.size++
    }

    search(s_id){
        let current = this.head
        while (current != null){
            if (current.id == s_id){
                return current
            }
            current = current.next
        } 
    }

    delete(d_id){
        if (this.search(d_id)==null) return;

        if (this.head.id == d_id){
            this.head = this.head.next
        } else {
            let current = this.head

            while (current.next != null){
                if (current.next.id == d_id){
                    current.next = current.next.next
                    break
                }
                current = current.next
            } 
        }
        this.size--
    }

    update(u_id, data){
        if (this.search(u_id) == null) return;
        const node = this.search(u_id)
        node.data = data
    }

    *[Symbol.iterator]() {
        if (!this.head) return;
        let current = this.head
        while(current != null) {
            yield current
            current = current.next
        }
    }
}

class Node {
    constructor(id, data){
        this.id = id
        this.data = data
        this.next = null
    }
}