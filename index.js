require('dotenv').config();
const express = require('express');
var session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static('assets'));
app.use(session({
    secret: process.env.SESSION_SECRET
}));

const core = require('./modules/core');
app.use('/', core);

const users = require('./modules/users');
app.use('/users', users);

const steps = require('./modules/steps');
app.use('/steps', steps);

const profile = require('./modules/profile');
app.use('/profile', profile);


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
