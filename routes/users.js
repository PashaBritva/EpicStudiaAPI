const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { db } = require('../bin/db');
require('dotenv').config();

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'default_secret_key';
const SALT_ROUNDS = 10;

router.use(cookieParser());

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send('Заполните все поля');

    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function (err) {
            if (err) return res.status(400).send('Пользователь уже существует');
            loginToken(req, res); // Логин после успешной регистрации
        });
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

router.post('/login', async (req, res) => {
    await loginToken(req, res);
});

async function loginToken(req, res) {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send('Заполните все поля');

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) return res.status(400).send('Неверный логин или пароль');

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).send('Неверный логин или пароль');

        const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.status(200).json({ message: 'Успешный вход', user: { id: user.id, username: user.username, role: user.role } });
    });
}

router.get('/profile', authenticateToken, (req, res) => {
    db.get('SELECT id, username, role, blocked FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).send('Пользователь не найден');
        res.status(200).json(user);
    });
});

router.delete('/:id', authenticateToken, checkAdmin, (req, res) => {
    const userId = req.params.id;
    db.get('SELECT id FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.status(404).send('Пользователь не найден');

        db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
            if (err) return res.status(500).send('Ошибка при удалении');
            res.status(200).send('Пользователь удалён');
        });
    });
});

router.get('/all', authenticateToken, checkAdmin, (req, res) => {
    db.all('SELECT id, username, role, blocked FROM users', (err, result) => {
        if (err) return res.status(500).send(err);
        res.status(200).json(result);
    });
});

router.get('/:id', authenticateToken, checkAdmin, (req, res) => {
    const userId = req.params.id;
    db.get('SELECT id, username, role, blocked FROM users WHERE id = ?', [userId], (err, result) => {
        if (err) return res.status(500).send(err);
        res.status(200).json(result);
    });
});

router.post('/:id/block', authenticateToken, checkAdmin, (req, res) => {
    const { blocked } = req.body;
    const userId = req.params.id;

    db.run('UPDATE users SET blocked = ? WHERE id = ?', [blocked, userId], (err) => {
        if (err) return res.status(500).send(err);
        return res.status(200).send('User is blocked');
    });
});

router.post('/:id/role', authenticateToken, checkAdmin, (req, res) => {
    const { role } = req.body;
    const userId = req.params.id;

    db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId], (err) => {
        if (err) return res.status(500).send(err);
        return res.status(200).send('User role updated');
    });
});

function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).send('Доступ запрещён');

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).send('Недействительный токен');
        req.user = user;
        next();
    });
}

function checkAdmin(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).send('Недостаточно прав');
    }
    next();
}

module.exports = router;
