require('dotenv').config()
const { 
    createClient,
} = require('redis')

let client;

module.exports = async () => {
    if (client) {
        return client
    }

    client = createClient({
        username: process.env.REDIS_USER,
        password: process.env.REDIS_PW,
        socket: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT
        }
    });

    client.on('error', err => console.log('Redis Client Error', err));

    await client.connect();

    console.log("Initialized Client for Redis Cache")

    return client
}