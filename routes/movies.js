var express = require('express')
const cors = require('cors');
const multer = require('multer')
var { db } = require('../bin/db');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


let router = express.Router();
router.use(cors());
router.use(express.json());


router.get('/:id/stream', (req, res) => {
    const movieId = req.params.id;
    const filePath = path.join(__dirname, '..', `uploads/${movieId}`, `${movieId}.mp4`);

    fs.stat(filePath, (err, stats) => {
        if (err) {
            return res.status(404).send('Файл не найден');
        }

        let { range } = req.headers;
        if (!range) {
            range = 'bytes=0-';
        }

        const CHUNK_SIZE = 50 ** 6;
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

        if (start >= stats.size) {
            res.status(416).send('Запрос за пределами размера файла');
            return;
        }

        const chunkEnd = Math.min(start + CHUNK_SIZE - 1, end);
        const contentLength = chunkEnd - start + 1;

        res.setHeader('Content-Disposition', 'inline'); // Отключаем скачивание
        res.setHeader('Cache-Control', 'no-store');
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${chunkEnd}/${stats.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': contentLength,
            'Content-Type': 'video/mp4',
            'Cache-Control': 'no-store',
            'Content-Disposition': 'inline'
        });

        const stream = fs.createReadStream(filePath, { start, end: chunkEnd });
        stream.pipe(res);
    });
});

router.post('/upload', upload.single('fullMovie'), (req, res) => {
    const { title, description, hashtags, trailerUrl } = req.body;
    if (!req.file || !title || !description || !trailerUrl || !Array.isArray(JSON.parse(hashtags))) {
        return res.status(400).send('Invalid input data');
    }

    const filePath = `/uploads/${req.file.filename}`;
    const parsedHashtags = JSON.parse(hashtags);

    db.run(
        'INSERT INTO movies (title, description, hashtags, trailerUrl, fullMovieUrl) VALUES (?, ?, ?, ?, ?)',
        [title, description, parsedHashtags.join(','), trailerUrl, filePath],
        (err) => {
            if (err) {
                res.status(400).send('Failed to add movie');
            } else {
                res.status(201).json({ message: 'Movie added', filePath });
            }
        }
    );
});

router.post('/', (req, res) => {
    const { title, description, hashtags, trailerUrl, fullMovieUrl } = req.body;
    if (!title || !description || !trailerUrl || !fullMovieUrl || !Array.isArray(hashtags)) {
        return res.status(400).send('Invalid input data');
    }
    
    db.run('INSERT INTO movies (title, description, hashtags, trailerUrl, fullMovieUrl) VALUES (?, ?, ?, ?, ?)',
        [title, description, hashtags.join(','), trailerUrl, fullMovieUrl],
        (err) => {
          if (err) {
            res.status(400).send('Failed to add movie');
          } else {
            res.status(201).send('Movie added');
          }
        }
    );
});
  
router.get('/', (req, res) => {
    db.all('SELECT * FROM movies', [], (err, movies) => {
      if (err) {
        res.status(500).send('Failed to retrieve movies');
      } else {
        res.status(200).json(movies);
      }
    });
});

router.get('/:id', (req, res) => {
    const movieId = req.params.id;
    db.get('SELECT * FROM movies WHERE id = ?', [movieId], (err, movie) => {
      if (err) {
        res.status(500).send('Failed to retrieve movie');
      } else if (!movie) {
        res.status(404).send('Movie not found');
      } else {
        res.status(200).json(movie);
      }
    });
});

router.get('/:id/comments', async (req, res) => {
    const movieId = req.params.id;
    db.all('SELECT user, text FROM comments WHERE movieId = ?', [movieId], (err, comments) => {
        if (err) {
            res.status(500).json({ error });
        } else {
            res.status(200).json(comments);
        }
    });
});

router.post('/:id/comment', (req, res) => {
    const { user, text } = req.body;
    const movieId = req.params.id;
    if (!user || !text) {
        return res.status(400).send('Invalid comment data');
    }
    db.run('INSERT INTO comments (movieId, user, text) VALUES (?, ?, ?)', [movieId, user, text], (err) => {
      if (err) {
        res.status(400).send('Failed to add comment');
      } else {
        res.status(201).send('Comment added');
      }
    });
});

module.exports = router;
