const { createClient } = require('redis');

const client = createClient({
    username: 'default',
    password: 'fZacrRZCsBp6ASck425f63DZ1X67Rp6t',
    socket: {
        host: 'redis-12747.c292.ap-southeast-1-1.ec2.redns.redis-cloud.com',
        port: 12747
    }
});

client.on('error', err => console.log('Redis Client Error', err));

module.exports = client