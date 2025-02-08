require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
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

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch((err) => console.error('MongoDB connection error:', err));

const messageSchema = new mongoose.Schema({
    text: String,
    channel: String,
    pseudo: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

let channels = { general: [] };
const userChannels = {};
const connectedUsers = {};

io.on('connection', (socket) => {
    let userPseudo = null;

    socket.on('setPseudo', (pseudo) => {
        if (!pseudo.trim()) return socket.emit('error', 'Pseudo cannot be empty');
        userPseudo = pseudo;
        connectedUsers[socket.id] = userPseudo;
        userChannels[pseudo] = userChannels[pseudo] || ["general"];
        socket.emit('pseudoSet', userPseudo);
        socket.emit('updateUserChannels', userChannels[pseudo]);
    });

    socket.on('joinChannel', async (channel) => {
        if (!channels[channel]) {
            return socket.emit('error', `Channel "${channel}" does not exist.`);
        }

        if (channel.includes('_')) {
            const [user1, user2] = channel.split('_');
            if (userPseudo !== user1 && userPseudo !== user2) {
                return socket.emit('error', 'You do not have permission to join this private channel.');
            }
        }

        socket.join(channel);
        const messages = await Message.find({ channel }).sort({ timestamp: 1 });
        socket.emit('initial messages', messages);
    });

    socket.on('quitChannel', (channel) => {
        if (!userChannels[userPseudo]) return;
        userChannels[userPseudo] = userChannels[userPseudo].filter(c => c !== channel);
        socket.leave(channel);
        socket.emit('updateUserChannels', userChannels[userPseudo]);
    });
});

server.listen(5000, () => console.log('Server running on port 5000'));