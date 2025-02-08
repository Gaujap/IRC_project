require('dotenv').config();
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

app.use(express.json());

server.listen(5000, () => console.log('Server running on port 5000'));