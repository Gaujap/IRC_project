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

    socket.on('addChannel', (channel) => {
        if (!userChannels[userPseudo].includes(channel)) {
            userChannels[userPseudo].push(channel);
            socket.emit('updateUserChannels', userChannels[userPseudo]);
        }
    });

    socket.on('chat message', ({ channel, message }) => {
        const msg = new Message({ text: message, channel, pseudo: userPseudo });
        msg.save();

        if (channel.includes('_')) {
            const [user1, user2] = channel.split('_');
            const user1SocketId = Object.keys(connectedUsers).find(id => connectedUsers[id] === user1);
            const user2SocketId = Object.keys(connectedUsers).find(id => connectedUsers[id] === user2);

            if (user1SocketId) io.to(user1SocketId).emit('chat message', { text: message, pseudo: userPseudo, channel });
            if (user2SocketId) io.to(user2SocketId).emit('chat message', { text: message, pseudo: userPseudo, channel });
        } else {
            io.to(channel).emit('chat message', { text: message, pseudo: userPseudo, channel });
        }
    });

    socket.on('privateMessage', ({ pseudo, message }) => {
        const targetSocketId = Object.keys(connectedUsers).find(
            (socketId) => connectedUsers[socketId] === pseudo
        );

        if (targetSocketId) {
            io.to(targetSocketId).emit('chat message', { text: `Private message from ${userPseudo}: ${message}`, pseudo: userPseudo });
            socket.emit('chat message', { text: `To ${pseudo}: ${message}`, pseudo: userPseudo });
        } else {
            socket.emit('error', `User ${pseudo} not found.`);
        }
    });

    socket.on('createPrivateChannel', ({ privateChannel, target, message }) => {
        if (!channels[privateChannel]) {
            channels[privateChannel] = [];
        }

        const targetSocketId = Object.keys(connectedUsers).find(id => connectedUsers[id] === target);
        if (!targetSocketId) {
            return socket.emit('error', `User ${target} not found.`);
        }

        userChannels[userPseudo] = userChannels[userPseudo] || [];
        userChannels[target] = userChannels[target] || [];

        if (!userChannels[userPseudo].includes(privateChannel)) {
            userChannels[userPseudo].push(privateChannel);
        }
        if (!userChannels[target].includes(privateChannel)) {
            userChannels[target].push(privateChannel);
        }

        socket.join(privateChannel);
        io.to(targetSocketId).emit('updateUserChannels', userChannels[target]);
        io.to(socket.id).emit('updateUserChannels', userChannels[userPseudo]);

        if (message) {
            const msg = new Message({ text: message, channel: privateChannel, pseudo: userPseudo });
            msg.save();
            io.to(privateChannel).emit('chat message', { text: message, pseudo: userPseudo, channel: privateChannel });
        }
    });

    socket.on('listUsers', () => {
        socket.emit('usersListResponse', Object.values(connectedUsers));
    });

    socket.on('listChannels', () => {
        const publicChannels = Object.keys(channels).filter(channel => !channel.includes('_'));
        const privateChannels = Object.keys(channels).filter(channel =>
            channel.includes('_') && channel.split('_').includes(userPseudo)
        );

        socket.emit('updateChannels', [...publicChannels, ...privateChannels]);
    });
});

server.listen(5000, () => console.log('Server running on port 5000'));