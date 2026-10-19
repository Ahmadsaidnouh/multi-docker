const keys = require('./keys');
const redis = require('redis');

const redisClient = redis.createClient({
    socket: {
        host: keys.redisHost,
        port: keys.redisPort,
        retry_strategy: () => 1000  // retries every 1000ms, tells the redisClient to retry connection every 1000ms if lost connection with Redis
    }
});

function fib(index) {
    if (index < 2) return 1;
    return fib(index - 1) + fib(index - 2);
}

(async () => {
    await redisClient.connect();

    const subscriber = redisClient.duplicate();
    await subscriber.connect();

    await subscriber.subscribe('insert', async (message) => {
        console.log(`Received message: ${message}`);

        await redisClient.hSet(
            'values',
            message,
            fib(parseInt(message))
        );
    });
})();