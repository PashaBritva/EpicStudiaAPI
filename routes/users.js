const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../bin/db');
require('dotenv').config();

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'sdhfui@#%RE$#32214hg0syd7fy4509tf87ATS*TSA*FT*&ST*FT$T*Gsagfgwe7gf42397gdwt3rt2';

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send('Заполните все поля');

    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', 
        [username, hashedPassword], 
        (err) => {
            if (err) return res.status(400).send('Пользователь уже существует');
            res.status(201).send('Регистрация успешна');
        }
    );
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send('Заполните все поля');

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) return res.status(400).send('Неверный логин или пароль');

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).send('Неверный логин или пароль');

        const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, secure: true });
        res.status(200).json({ token });
    });
});

router.get('/profile', authenticateToken, (req, res) => {
    db.get('SELECT id, username, role FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).send('Пользователь не найден');
        res.status(200).json(user);
    });
});

function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send('Доступ запрещён');

    jwt.verify(token.split(' ')[1], SECRET_KEY, (err, user) => {
        if (err) return res.status(403).send('Недействительный токен');
        req.user = user;
        next();
    });
}

function checkAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).send('Недостаточно прав');
    next();
}

router.delete('/:id', authenticateToken, checkAdmin, (req, res) => {
    const userId = req.params.id;
    db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
        if (err) return res.status(500).send('Ошибка при удалении');
        res.status(200).send('Пользователь удалён');
    });
});

module.exports = router;