const cfg = require('../../../config.json')

module.exports = class Queue {
    constructor(){
        this.front = null
        this.rear = null
        this.size = 0
    }

    static getInstance(){
        if (!Queue.instance) {
            Queue.instance = new Queue();
        }
        return Queue.instance
    }

    isFull(){
        return this.size == cfg.maxQueueSize
    }

    isEmpty(){
        return this.size == 0
    }

    getSize(){
        return this.size
    }

    enqueue(data){
        const node = new Node(data)
        if (!this.front) { 
            this.front = node
            this.rear = node
        } else {
            this.rear.next = node
            this.rear = node
        }
        this.size++
    }

    dequeue(){
        if (!this.front) return;
        const removedNode = this.front
        this.front = this.front.next
        if (!this.front) {
            this.rear = null;
        }
        this.size--
        return removedNode.data
    }

    *[Symbol.iterator]() {
        if (!this.front) return;
        let current = this.front
        while(current !== this.rear.getNext()) {
            yield { data: current.getData() }
            current = current.getNext()
        }
    }
}   

class Node{
    constructor(data, next=null){
        this.data = data
        this.next = next
    }

    setNext(ref){
        this.next = ref
    }

    setData(data){
        this.data = data
    }

    getData(){
        return this.data
    }

    getNext(){
        return this.next
    }
}