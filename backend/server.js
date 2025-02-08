require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://irc-front.onrender.com",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

server.listen(5000, () => console.log('Server running on port 5000'));