var mysql = require('mysql');

var pool = mysql.createPool({
    host: process.env.DBHOST,
    database: process.env.DBNAME,
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    connectionLimit: 10
});

pool.getConnection((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Connected to the database.');
    }
});

module.exports = pool;