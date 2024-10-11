const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');
const sharedSession = require("socket.io-express-session");

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Database setup (using SQLite with Sequelize)
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'users.db'
});

// Define User model
const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

// Middleware
const sessionMiddleware = session({
    secret: 'secret!',
    resave: false,
    saveUninitialized: true
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(sessionMiddleware);

// Share session with Socket.io
io.use(sharedSession(sessionMiddleware, {
    autoSave: true
}));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });

    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.user = user.username;
        return res.redirect('/chat');
    } else {
        res.redirect('/login');
    }
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
        await User.create({ username, password: hashedPassword });
        req.session.user = username;
        res.redirect('/chat');
    } catch (error) {
        res.redirect('/register');
    }
});

app.get('/chat', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Socket.io handling
io.on('connection', (socket) => {
    const username = socket.handshake.session.user;

    socket.on('message', (msg) => {
        io.emit('message', `${username}: ${msg}`);
    });
});

// Initialize database and start server
sequelize.sync().then(() => {
    server.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
    });
});
