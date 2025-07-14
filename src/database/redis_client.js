import { createClient } from 'redis';
require('dotenv').config();

const client = createClient({
    username: process.env.REDIS_USER,
    password: process.env.REDIS_PW,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

module.exports = client
