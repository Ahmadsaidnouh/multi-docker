const keys = require('./keys');

// Express app setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors()); // Cross Origin Resource Sharing
app.use(bodyParser.json());

// Postgres client setup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort,
    ssl:
        process.env.NODE_ENV !== 'production'
        ? false
        : { rejectUnauthorized: false },
});

pgClient.on('error', () => console.log('Lost PG connection'));

pgClient.on("connect", (client) => {
  client
    .query("CREATE TABLE IF NOT EXISTS values (number INT)")
    .catch((err) => console.log("Error creating table",err));
});

// Redis client setup
const redis = require('redis');
const redisClient = redis.createClient({
    socket: {
        host: keys.redisHost,
        port: keys.redisPort,
    },
    retry_strategy: () => 1000
});
redisClient.connect();
const redisPublisher = redisClient.duplicate();
redisPublisher.connect();

// Express route handlers
app.get('/', (req, res) => {
    res.send('Hi');
});
app.get('/values/all', async (req, res) => {
    console.log('Fetching all values from Postgres');
    const values = await pgClient.query('SELECT * FROM values');
    res.send(values.rows);
});
app.get('/values/current', async (req, res) => {
    try {
        console.log('Fetching current values from Redis');

        const values = await redisClient.hGetAll('values');
        res.send(values);

    } catch (err) {
        console.error('Error fetching values from Redis', err);
        res.status(500).send('Error fetching values from Redis');
    }
});
app.post('/values', async (req, res) => {
    const index = req.body.index;
    if (parseInt(index) > 40) {
        return res.status(422).send('Index too high');
    }
    redisClient.hSet('values', index, 'Nothing yet!');
    redisPublisher.publish('insert', index);
    await pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
    res.send({ working: true });
});

app.listen(5000, err => {
    console.log('Listening on port 5000');
});