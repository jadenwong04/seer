const WriteOperation = {
    insert: "Insert",
    delete: "Delete",
    update: "Update"
}

async function get_ignored_channels(mysql_session, redis_client, guild_id) {
    const cached_key = `ignored_channels:${guild_id}` 
    const cached_exist_ignored_channels = await redis_client.exists(cached_key)
    if (cached_exist_ignored_channels === 1) {
        return await redis_client.sMembers(cached_key)
    } else {
        //cache-miss
        const db_ignored_channels = (await(await mysql_session.sql(
            `
                SELECT channel_id 
                FROM ignored_channel
                WHERE guild_id = ?
            `
        ).bind(guild_id).execute()).fetchAll()).map(channel => channel[0])

        if (db_ignored_channels.length > 0) {
            await redis_client.sAdd(cached_key, db_ignored_channels)
        }
        
        return db_ignored_channels
    }
}

async function get_authorized_role(mysql_session, redis_client, guild_id) {
    const cached_key = `authorized_role:${guild_id}` 
    const cached_exist_authorized_role = await redis_client.exists(cached_key)
    if (cached_exist_authorized_role === 1) {
        return await redis_client.get(cached_key)
    } else {
        //cache-miss
        const [db_authorized_role] = await(await mysql_session.sql(
            `
                SELECT auth_role 
                FROM guild
                WHERE guild_id = ?
            `
        ).bind(guild_id).execute()).fetchOne()

        await redis_client.set(cached_key, String(db_authorized_role))

        return db_authorized_role
    }
}

async function get_lookout_terms(mysql_session, redis_client, guild_id) {
    const cached_key = `lookout_terms:${guild_id}` 
    const cached_exist_lookout_terms = await redis_client.exists(cached_key)
    if (cached_exist_lookout_terms === 1) {
        return await redis_client.hVals(cached_key)
    } else {
        //cache-miss
        const db_lookout_terms = (await(await mysql_session.sql(
            `
                SELECT term, max_offset 
                FROM guild_lookout_term
                WHERE guild_id = ?
            `
        ).bind(guild_id).execute()).fetchAll()).map(lookout_term => [lookout_term[0], `${lookout_term[0]}:${lookout_term[1]}`])

        if (db_lookout_terms.length > 0) {
            await redis_client.hSet(cached_key, Object.fromEntries(db_lookout_terms))
        }

        return await redis_client.hVals(cached_key)
    }
}

async function write_ignored_channel(mysql_session, redis_client, guild_id, channel_id, write_operation) {
    const cached_key = `ignored_channels:${guild_id}` 
    //write-through caching
    switch(write_operation){
        case WriteOperation.insert:
            await redis_client.sAdd(cached_key, channel_id)
            await mysql_session.sql(
                `
                    INSERT INTO ignored_channel (channel_id, guild_id)
                    VALUES (?, ?)
                `
            ).bind(channel_id, guild_id).execute()
            break
        case WriteOperation.delete:
            await redis_client.sRem(cached_key, channel_id)
            await mysql_session.sql(
                `
                    DELETE FROM ignored_channel
                    WHERE guild_id = ? AND channel_id = ?
                `
            ).bind(guild_id, channel_id).execute()
            break
        default:
            throw Error(`Unsupported Write Operation: ${write_operation}`)
    }
}

async function write_authorized_role(mysql_session, redis_client, guild_id, role_id, write_operation) {
    const cached_key = `authorized_role:${guild_id}` 
    //write-through caching
    switch(write_operation){
        case WriteOperation.update:
            await redis_client.set(cached_key, role_id)
            await mysql_session.sql(
                `
                    UPDATE guild 
                    SET auth_role = ?
                    WHERE guild_id = ?
                `
            ).bind(role_id, guild_id).execute()
            break
        case WriteOperation.delete:
            await redis_client.del(cached_key)
            await mysql_session.sql(
                `
                    UPDATE guild
                    SET auth_role = NULL
                    WHERE guild_id = ?
                `
            ).bind(guild_id).execute()
            break
        default:
            throw Error(`Unsupported Write Operation: ${write_operation}`)
    }
}

async function write_lookout_terms(mysql_session, redis_client, guild_id, term, offset, write_operation) {
    const cached_key = `lookout_terms:${guild_id}`
    switch(write_operation){
        case WriteOperation.insert:
            await redis_client.hSetNX(cached_key, term, `${term}:${offset}`)
            await mysql_session.sql(
                `
                    INSERT INTO guild_lookout_term (guild_id, term, max_offset)
                    VALUES (?, ?, ?)
                `
            ).bind(guild_id, term, offset).execute()
            break;
        case WriteOperation.delete:
            await redis_client.hDel(cached_key, term)
            await mysql_session.sql(
                `
                    DELETE FROM guild_lookout_term
                    WHERE guild_id = ? AND term = ?
                `
            ).bind(guild_id, term).execute()
            break;
        case WriteOperation.update:
            await redis_client.hSet(cached_key, term, `${term}:${offset}`)
            await mysql_session.sql(
                `
                    UPDATE guild_lookout_term 
                    SET max_offset = ?
                    WHERE guild_id = ? AND term = ?
                `
            ).bind(offset, guild_id, term).execute()
            break;
        default:
            throw Error(`Unsupported Write Operation: ${write_operation}`)
    }
}

module.exports = {
    WriteOperation,
    get_ignored_channels,
    write_ignored_channel,
    get_authorized_role,
    write_authorized_role,
    get_lookout_terms,
    write_lookout_terms
}