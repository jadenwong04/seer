module.exports = class Stack{
    constructor(capacity){
        this.items = Array(capacity).fill(null)
        this.top = -1
        this.capacity = capacity
    }

    is_full(){
        return this.top + 1 == this.capacity
    }

    is_empty(){
        return this.top < 0
    }

    push(data){
        if(this.is_full()) return;
        this.items[this.top+1] = data
        this.top+=1
    }

    pop(){
        if(this.is_empty()) return;
        const data = this.items[this.top]
        this.items[this.top]=null
        this.top-=1
        return data
    }
}