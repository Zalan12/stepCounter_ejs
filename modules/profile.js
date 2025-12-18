const express = require('express');
const router = express.Router();
const ejs = require('ejs');
const db = require('./db');

const passwdRegExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;

function loginCheck(req, res, next) {
    if (req.session.user) return next();
    return res.redirect('/users/login');
}

// Profile page
router.get('/', loginCheck, (req, res) => {
    // use fresh data from DB to be safe
    db.query('SELECT id, name, email, createdAt FROM users WHERE id = ?', [req.session.user.id], (err, results) => {
        if (err || results.length === 0) {
            req.session.error = "Nem sikerült betölteni a profilt!";
            req.session.severity = "danger";
            return res.redirect('/steps');
        }

        const user = results[0];

        let error = req.session.error;
        let severity = req.session.severity;
        req.session.error = null;
        req.session.severity = null;

        ejs.renderFile('views/profile/profile.ejs', { session: req.session, user, error, severity }, (err, html) => {
            if (err) console.log(err);
            res.send(html);
        });
    });
});

// Update name + email
router.post('/update', loginCheck, (req, res) => {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim();

    if (!name || !email) {
        req.session.error = "A név és az email megadása kötelező!";
        req.session.severity = "danger";
        return res.redirect('/profile');
    }

    db.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.session.user.id], (err) => {
        if (err) {
            // duplicate email
            if (err.code === 'ER_DUP_ENTRY') {
                req.session.error = "Ez az email cím már foglalt!";
                req.session.severity = "danger";
                return res.redirect('/profile');
            }
            req.session.error = "Hiba történt a mentés során!";
            req.session.severity = "danger";
            return res.redirect('/profile');
        }

        // keep session in sync (do not touch login logic)
        req.session.user.name = name;
        req.session.user.email = email;

        req.session.error = "A profiladatok frissítve!";
        req.session.severity = "success";
        return res.redirect('/profile');
    });
});

// Update password (keeps legacy SHA1 hashing used by the existing auth module)
router.post('/password', loginCheck, (req, res) => {
    const oldPassword = req.body.oldPassword || '';
    const newPassword = req.body.newPassword || '';
    const newPassword2 = req.body.newPassword2 || '';

    if (!oldPassword || !newPassword || !newPassword2) {
        req.session.error = "Minden jelszó mezőt ki kell tölteni!";
        req.session.severity = "danger";
        return res.redirect('/profile');
    }

    if (newPassword !== newPassword2) {
        req.session.error = "Az új jelszavak nem egyeznek!";
        req.session.severity = "danger";
        return res.redirect('/profile');
    }

    if (!passwdRegExp.test(newPassword)) {
        req.session.error = "Az új jelszó nem megfelelő! (min. 8 karakter, kisbetű, nagybetű, szám)";
        req.session.severity = "danger";
        return res.redirect('/profile');
    }

    // verify old password using the same scheme as login
    db.query('SELECT id FROM users WHERE id = ? AND password = SHA1(?)', [req.session.user.id, oldPassword], (err, results) => {
        if (err) {
            req.session.error = "Hiba történt az ellenőrzés során!";
            req.session.severity = "danger";
            return res.redirect('/profile');
        }

        if (results.length === 0) {
            req.session.error = "A régi jelszó hibás!";
            req.session.severity = "danger";
            return res.redirect('/profile');
        }

        db.query('UPDATE users SET password = SHA1(?) WHERE id = ?', [newPassword, req.session.user.id], (err2) => {
            if (err2) {
                req.session.error = "Hiba történt a jelszó mentése során!";
                req.session.severity = "danger";
                return res.redirect('/profile');
            }

            req.session.error = "Jelszó sikeresen módosítva!";
            req.session.severity = "success";
            return res.redirect('/profile');
        });
    });
});

module.exports = router;
