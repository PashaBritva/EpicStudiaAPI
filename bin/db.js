const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./movies.sqlite', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user'
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY,
      title TEXT,
      description TEXT,
      hashtags TEXT,
      trailerUrl TEXT,
      fullMovieUrl TEXT,
      rating INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY,
      movieId INTEGER,
      user TEXT,
      text TEXT,
      FOREIGN KEY (movieId) REFERENCES movies(id)
    )`);
  }
});

module.exports = { db };