const cfg = require('../config.json')
const Queue = require('./util/queue')
const LinkedList = require('./util/linked_list')
const queue = Queue.getInstance()
const { update_user_sentiment } = require('./hard_moderation')

module.exports = class Conversation {
    constructor(guildId, channelId){
        this.gid = guildId
        this.cid = channelId
        this.initData()
    }

    getMsg(msgId){
        return this.data.search(msgId)
    }

    addMsg(userId, msgId, msgContent){
        this.data.add(msgId, { id: userId, msg: msgContent })
        this.resetTimeout()
    }

    deleteMsg(msgId){
        this.data.delete(msgId)
        this.resetTimeout()
    }

    editMsg(msgId, msgContent){
        const { id } = this.getMsg(msgId)
        this.data.update(msgId, { id: id, msg: msgContent })
        this.resetTimeout()
    }

    resetTimeout(){
        if (this.timeout != null) clearTimeout(this.timeout)
        this.timeout = setTimeout(async () => await this.pushToQueue(), cfg.timeoutDuration)
    }

    initData(){
        this.data = new LinkedList()
        this.timeout = null
    }

    clone(){
        const new_instance = new Conversation(this.gid, this.cid)
        new_instance.data = this.data
        return new_instance
    }
    
    async pushToQueue(){
        if (queue.isFull()){
            const deqAll = () => {
                return queue.isEmpty() ? [] : [queue.dequeue()].concat(deqAll())
            }
            await Promise.all(deqAll().map(update_user_sentiment))
        }
        queue.enqueue(this.clone())
        this.initData()
    }
}