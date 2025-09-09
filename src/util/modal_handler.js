module.exports = class ModalHandler {
    constructor() {
        this.registry = new Map();
    }

    static get_instance() {
        if (ModalHandler.instance == null) {
            ModalHandler.instance = new ModalHandler()
        }
        return ModalHandler.instance
    }

    register(event_id, object, callback_name) {
        this.registry.set(event_id, { object, callback_name })
    }

    async submit(event_id, fields) {
        const { object, callback_name } = this.registry.get(event_id);
        return await object[callback_name](fields)
    }

    unregister(id) {
        this.registry.delete(id);
    }
}