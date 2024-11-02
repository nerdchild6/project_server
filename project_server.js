const express = require('express');
const path = require('path');
const app = express();
const con = require('./config/db');
const bcrypt = require('bcrypt');
const { request } = require('http');

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get("/welcome", function(req, res) {
    res.send("Welcome to you!");
});

//--------------- input register -----------
app.post('/register', function (req, res) {
    const { name, username, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match');
    }

    bcrypt.hash(password, 10, function (err, hash) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error1');
        }

        const sql = "INSERT INTO user (username, password, role, user_name, email) VALUES (?, ?, 'student', ?, ?)";
        con.query(sql, [username, hash, name, email], function (err, result) {
            if (err) {
                console.error(err);
                return res.status(500).send('Server error2');
            }
            console.log("User registered successfully");
            res.redirect(301, '/');
        });
    });
});

const port = process.env.PORT || 3000;
app.listen(port, function(){
    console.log("Server is ready at " + port);
});
