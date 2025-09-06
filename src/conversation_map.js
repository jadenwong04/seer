const CustomMap = require('./util/data_structures/map.js')
const Conversation = require('./conversation')

class GuildMap extends CustomMap {
    constructor(){
        super();
    }

    static getInstance(){
        if (!GuildMap.instance) {
            GuildMap.instance = new GuildMap();
        }
        return GuildMap.instance
    }

    addGuild(guildID){
        this.setValue(guildID, new ChannelMap(guildID))
    }

    removeGuild(guildID){
        this.setValue(guildID, null)
    }
}

class ChannelMap extends CustomMap{
    constructor(guildId){
        super();
        this.gid = guildId;
    }

    addChannel(channelID) {
        this.setValue(channelID, new Conversation(this.gid, channelID))
    }

    removeChannel(channelID){
        this.setValue(channelID, null)
    }
}

module.exports = GuildMap, ChannelMap;
