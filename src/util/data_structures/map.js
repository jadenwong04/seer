module.exports = class CustomMap {
    constructor(){
        this.map = new Map();
    }

    setValue(key, value){
        this.map.set(key, value)
    }

    removeValue(key){
        this.map.delete(key)
    }

    getValue(key){
        return this.map.get(key)
    }

    mapValues() {
        return Array.from(this.map.values())
    }

    getKeys(){
        return this.map.keys();
    }
}