const express = require('express');
const router = express.Router();
const db = require('./db');
const ejs = require('ejs');

router.get('/', (req, res) => {
    ejs.renderFile('views/system/index.ejs', {session : req.session}, (err, html) => {
        if (err) {
            console.log(err);
        } 
        res.send(html);
    });

});

module.exports = router;