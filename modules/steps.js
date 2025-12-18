
const express = require('express');
const router = express.Router();
const ejs = require('ejs');
const db = require('./db');
const moment = require('moment');

// LISTA: saját lépések
router.get('/', loginCheck, (req, res) => {
    db.query('SELECT * FROM steps WHERE userId = ? ORDER BY date DESC', [req.session.user.id], (err, results) => {
        if (err) {
            console.log(err);
            req.session.error = "Hiba történt az adatbázis lekérdezés során!";
            req.session.severity = "danger";
            return res.redirect('/steps');
        }

        // összes lépés
        const totalSteps = results.reduce((acc, r) => acc + (parseInt(r.steps, 10) || 0), 0);

        // heti összegzés (ISO hét)
        const weekMap = {};
        results.forEach(r => {
            const key = moment(r.date).isoWeekYear() + "-W" + String(moment(r.date).isoWeek()).padStart(2,'0');
            weekMap[key] = (weekMap[key] || 0) + (parseInt(r.steps,10) || 0);
        });

        // a táblázatban könnyebb, ha minden rekordhoz hozzárendeljük a heti kulcsot
        const rows = results.map(r => ({
            ...r,
            weekKey: moment(r.date).isoWeekYear() + "-W" + String(moment(r.date).isoWeek()).padStart(2,'0')
        }));

        // flash jellegű üzenet törlése (a meglévő projekt stílusa szerint)
        let error = req.session.error;
        let severity = req.session.severity;
        req.session.error = null;
        req.session.severity = null;

        ejs.renderFile('views/steps/steps.ejs', { session: req.session, steps: rows, weekMap, totalSteps, error, severity }, (err, html) => {
            if (err) console.log(err);
            res.send(html);
        });
    });
});

// ÚJ rekord felvitele (űrlap)
router.get('/new', loginCheck, (req, res) => {
    let body = req.session.body || {};
    req.session.body = null;

    ejs.renderFile('views/steps/steps-new.ejs', { session: req.session, body }, (err, html) => {
        if (err) console.log(err);
        res.send(html);
    });
});

// ÚJ mentés (ha már van adott dátumhoz, update)
router.post('/new', loginCheck, (req, res) => {
    let { date, steps } = req.body;
    req.session.body = req.body;

    // validációk
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        req.session.error = "A dátum formátuma: YYYY-MM-DD!";
        req.session.severity = "danger";
        return res.redirect('/steps/new');
    }

    const stepsNum = parseInt(steps, 10);
    if (!Number.isInteger(stepsNum) || stepsNum <= 0) {
        req.session.error = "A lépésszámnak pozitív egész számnak kell lennie!";
        req.session.severity = "danger";
        return res.redirect('/steps/new');
    }

    // ha létezik rekord ugyanarra a napra, update; különben insert
    db.query('SELECT id FROM steps WHERE userId = ? AND date = ?', [req.session.user.id, date], (err, found) => {
        if (err) {
            console.log(err);
            req.session.error = "Hiba történt a mentés során!";
            req.session.severity = "danger";
            return res.redirect('/steps/new');
        }

        if (found.length > 0) {
            const id = found[0].id;
            db.query('UPDATE steps SET steps = ? WHERE id = ? AND userId = ?', [stepsNum, id, req.session.user.id], (err2) => {
                if (err2) {
                    console.log(err2);
                    req.session.error = "Hiba történt a frissítés során!";
                    req.session.severity = "danger";
                    return res.redirect('/steps/new');
                }
                req.session.body = null;
                req.session.error = "A napi lépésszám frissítve lett!";
                req.session.severity = "success";
                return res.redirect('/steps');
            });
        } else {
            db.query('INSERT INTO steps (userId, date, steps) VALUES (?,?,?)', [req.session.user.id, date, stepsNum], (err3) => {
                if (err3) {
                    console.log(err3);
                    req.session.error = "Hiba történt a mentés során!";
                    req.session.severity = "danger";
                    return res.redirect('/steps/new');
                }
                req.session.body = null;
                req.session.error = "A napi lépésszám rögzítve lett!";
                req.session.severity = "success";
                return res.redirect('/steps');
            });
        }
    });
});


// NAPTÁR (később teljes megvalósítás)

// NAPTÁR nézet – FullCalendar (csak saját lépések)
router.get('/calendar', loginCheck, (req, res) => {
    db.query('SELECT id, date, steps FROM steps WHERE userId = ? ORDER BY date ASC', [req.session.user.id], (err, results) => {
        if (err) {
            console.log(err);
            req.session.error = "Hiba történt az adatok betöltése során!";
            req.session.severity = "danger";
            return res.redirect('/steps');
        }

        const events = results.map(r => ({
            id: r.id,
            title: `${r.steps} lépés`,
            start: moment(r.date).format('YYYY-MM-DD'),
            // kattintás -> szerkesztés
            url: `/steps/edit/${r.id}`
        }));

        let error = req.session.error;
        let severity = req.session.severity;
        req.session.error = null;
        req.session.severity = null;

        ejs.renderFile('views/steps/steps-calendar.ejs', { session: req.session, events, error, severity }, (err2, html) => {
            if (err2) console.log(err2);
            res.send(html);
        });
    });
});

// GRAFIKON (később teljes megvalósítás)

// GRAFIKON nézet – Chart.js (időszak: 7 nap / hónap / év)
router.get('/chart', loginCheck, (req, res) => {
    const range = (req.query.range || '7d').toLowerCase(); // 7d | month | year
    const today = moment().startOf('day');

    const render = (labels, values, title) => {
        let error = req.session.error;
        let severity = req.session.severity;
        req.session.error = null;
        req.session.severity = null;

        ejs.renderFile('views/steps/steps-chart.ejs', {
            session: req.session,
            labels,
            values,
            range,
            title,
            error,
            severity
        }, (err2, html) => {
            if (err2) console.log(err2);
            res.send(html);
        });
    };

    if (range === 'year') {
        const yearStart = today.clone().startOf('year').format('YYYY-MM-DD');
        const yearEnd = today.clone().endOf('year').format('YYYY-MM-DD');

        db.query(
            `SELECT MONTH(date) AS m, SUM(steps) AS s
             FROM steps
             WHERE userId = ? AND date BETWEEN ? AND ?
             GROUP BY MONTH(date)
             ORDER BY MONTH(date) ASC`,
            [req.session.user.id, yearStart, yearEnd],
            (err, results) => {
                if (err) {
                    console.log(err);
                    req.session.error = "Hiba történt a grafikon adatok betöltése során!";
                    req.session.severity = "danger";
                    return res.redirect('/steps');
                }

                const map = {};
                results.forEach(r => { map[r.m] = Number(r.s) || 0; });

                const labels = Array.from({ length: 12 }, (_, i) => moment(`${today.year()}-${String(i+1).padStart(2,'0')}-01`).format('MMMM'));
                const values = Array.from({ length: 12 }, (_, i) => map[i+1] || 0);

                return render(labels, values, `${today.year()} – havi összes lépés`);
            }
        );
        return;
    }

    if (range === 'month') {
        const start = today.clone().startOf('month');
        const end = today.clone().endOf('month');

        db.query(
            'SELECT date, steps FROM steps WHERE userId = ? AND date BETWEEN ? AND ? ORDER BY date ASC',
            [req.session.user.id, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')],
            (err, results) => {
                if (err) {
                    console.log(err);
                    req.session.error = "Hiba történt a grafikon adatok betöltése során!";
                    req.session.severity = "danger";
                    return res.redirect('/steps');
                }

                const map = {};
                results.forEach(r => { map[moment(r.date).format('YYYY-MM-DD')] = Number(r.steps) || 0; });

                const days = start.daysInMonth();
                const labels = [];
                const values = [];
                for (let d = 1; d <= days; d++) {
                    const dateStr = start.clone().date(d).format('YYYY-MM-DD');
                    labels.push(start.clone().date(d).format('MM.DD'));
                    values.push(map[dateStr] || 0);
                }

                return render(labels, values, `${start.format('YYYY MMMM')} – napi lépések`);
            }
        );
        return;
    }

    // default: last 7 days including today
    const start = today.clone().subtract(6, 'days');
    const end = today.clone();

    db.query(
        'SELECT date, steps FROM steps WHERE userId = ? AND date BETWEEN ? AND ? ORDER BY date ASC',
        [req.session.user.id, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')],
        (err, results) => {
            if (err) {
                console.log(err);
                req.session.error = "Hiba történt a grafikon adatok betöltése során!";
                req.session.severity = "danger";
                return res.redirect('/steps');
            }

            const map = {};
            results.forEach(r => { map[moment(r.date).format('YYYY-MM-DD')] = Number(r.steps) || 0; });

            const labels = [];
            const values = [];
            for (let i = 0; i < 7; i++) {
                const d = start.clone().add(i, 'days');
                const key = d.format('YYYY-MM-DD');
                labels.push(d.format('MM.DD'));
                values.push(map[key] || 0);
            }

            return render(labels, values, `Utolsó 7 nap – napi lépések`);
        }
    );
});

// SZERKESZTÉS (űrlap)
router.get('/edit/:id', loginCheck, (req, res) => {
    db.query('SELECT * FROM steps WHERE id = ? AND userId = ?', [req.params.id, req.session.user.id], (err, results) => {
        if (err || results.length === 0) {
            req.session.error = "A rekord nem található!";
            req.session.severity = "danger";
            return res.redirect('/steps');
        }

        ejs.renderFile('views/steps/steps-edit.ejs', { session: req.session, item: results[0] }, (err2, html) => {
            if (err2) console.log(err2);
            res.send(html);
        });
    });
});

// SZERKESZTÉS mentése
router.post('/edit/:id', loginCheck, (req, res) => {
    let { date, steps } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        req.session.error = "A dátum formátuma: YYYY-MM-DD!";
        req.session.severity = "danger";
        return res.redirect('/steps/edit/' + req.params.id);
    }

    const stepsNum = parseInt(steps, 10);
    if (!Number.isInteger(stepsNum) || stepsNum <= 0) {
        req.session.error = "A lépésszámnak pozitív egész számnak kell lennie!";
        req.session.severity = "danger";
        return res.redirect('/steps/edit/' + req.params.id);
    }

    // ha a dátumot átírják olyanra, ami már létezik, azt tiltsuk (egyszerű szabály)
    db.query('SELECT id FROM steps WHERE userId = ? AND date = ? AND id <> ?', [req.session.user.id, date, req.params.id], (err, found) => {
        if (err) {
            console.log(err);
            req.session.error = "Hiba történt a mentés során!";
            req.session.severity = "danger";
            return res.redirect('/steps/edit/' + req.params.id);
        }
        if (found.length > 0) {
            req.session.error = "Erre a dátumra már van rögzített lépésszám!";
            req.session.severity = "danger";
            return res.redirect('/steps/edit/' + req.params.id);
        }

        db.query('UPDATE steps SET date = ?, steps = ? WHERE id = ? AND userId = ?', [date, stepsNum, req.params.id, req.session.user.id], (err2) => {
            if (err2) {
                console.log(err2);
                req.session.error = "Hiba történt a frissítés során!";
                req.session.severity = "danger";
                return res.redirect('/steps/edit/' + req.params.id);
            }
            req.session.error = "A rekord frissítve lett!";
            req.session.severity = "success";
            return res.redirect('/steps');
        });
    });
});

// TÖRLÉS megerősítés
router.get('/delete/:id', loginCheck, (req, res) => {
    db.query('SELECT * FROM steps WHERE id = ? AND userId = ?', [req.params.id, req.session.user.id], (err, results) => {
        if (err || results.length === 0) {
            req.session.error = "A rekord nem található!";
            req.session.severity = "danger";
            return res.redirect('/steps');
        }

        ejs.renderFile('views/steps/steps-delete.ejs', { session: req.session, item: results[0] }, (err2, html) => {
            if (err2) console.log(err2);
            res.send(html);
        });
    });
});

// TÖRLÉS végrehajtás
router.post('/delete/:id', loginCheck, (req, res) => {
    db.query('DELETE FROM steps WHERE id = ? AND userId = ?', [req.params.id, req.session.user.id], (err) => {
        if (err) {
            console.log(err);
            req.session.error = "Hiba történt a törlés során!";
            req.session.severity = "danger";
            return res.redirect('/steps');
        }
        req.session.error = "A rekord törölve lett!";
        req.session.severity = "success";
        return res.redirect('/steps');
    });
});


function loginCheck(req, res, next) {
    if (req.session.user) {
        return next();
    }
    return res.redirect('/users/login');
}

module.exports = router;
