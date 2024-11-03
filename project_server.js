const express = require('express');
const path = require('path');
const app = express();
const con = require('./config/db');
const bcrypt = require('bcrypt');
const { request } = require('http');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//--------------- test backend ------------
app.get("/welcome", function (req, res) {
    res.send("Welcome to you!");
});

//--------------- hash password ------------
app.get('/password/:raw', function (req, res) {
    const raw = req.params.raw;
    bcrypt.hash(raw, 10, function (err, hash) {
        if (err) {
            console.error(err);
            res.status(500).send('Server error');
        }
        else {
            console.log(hash.length);
            res.status(200).send(hash);
        }
    });
});
//---------------- input login -------------
app.post('/login', function (req, res) {
    const username = req.body.username;
    const raw_password = req.body.password;

    const sql = "SELECT username, password, role, user_name, email FROM user WHERE username=?";
    con.query(sql, [username], function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        if (results.length === 0) {
            return res.status(401).send('Login failed: username is wrong');
        }

        const hash = results[0].password;
        bcrypt.compare(raw_password, hash, function (err, same) {
            if (err) {
                console.error(err);
                return res.status(500).send('Server error');
            }
            if (same) {
                const role = results[0].role;
                res.send(results[0]);
                if (role === 'student') {
                    console.log('student');

                } else if (role === 'admin') {
                    console.log('admin');
                } else {
                    console.log('approver');
                }

            } else {
                return res.status(401).send('Login failed: wrong password');
            }
        });
    });
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
        });
    });
});

// ---------------- get assets info ----------------
app.get('/all_asset', function (req, res) {
    const sql = "SELECT * FROM asset";
    con.query(sql, function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

//---------------- get assets info with catagorie----------------
app.get('/asset/:categorie', function (req, res) {
    const categorie = req.params.categorie;
    const sql = "SELECT * FROM asset WHERE categorie =?";
    con.query(sql, [categorie], function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

//---------------- get assets info with search asset name ----------------
app.get('/asset', function (req, res) {
    const asset_name = req.query.asset_name;
    const sql = "SELECT * FROM asset WHERE LOWER(asset_name) LIKE LOWER(?)";
    con.query(sql, [`%${asset_name}%`], function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

//---------------- get detail asset info ----------------
app.get('/asset/asset_id/:asset_id', function (req, res) {
    const asset_id = req.params.asset_id;
    const sql = "SELECT * FROM asset WHERE asset_id =?";
    con.query(sql, [asset_id], function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

//--------------- insert student request to database -----------
app.post('/borrow', (req, res) => {
    const { asset_id, user_id } = req.body;

    const getUserIdSql = "SELECT user_id FROM user WHERE user_id = ?";
    con.query(getUserIdSql, [user_id], (err, results) => {
        if (err) {
            console.error('Error querying user:', err);
            return res.status(500).send('Error querying user');
        }

        if (results.length === 0) {
            return res.status(404).send('User not found');
        }
        //get user_id
        const userId = results[0].user_id;

        const same_today = "SELECT * FROM request WHERE borrower_id = ? AND borrow_date = CURRENT_DATE AND (approve_status = 'pending' OR approve_status = 'approved')";
        con.query(same_today, [userId], (err, results) => {
            if (err) {
                console.error('Error querying database:', err);
                res.status(500).json({ error: 'Error querying database' });
                return;
            }
            if (results.length > 0) {
                return res.status(200).send('can borrow only one movie per day');
            } else {
                const insert_request = "INSERT INTO request (asset_id, borrower_id, borrow_date, return_date, approve_status) VALUES (?, ?, CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY), 'pending')";
                con.query(insert_request, [asset_id, userId], (err, result) => {
                    if (err) {
                        console.error('Error inserting request:', err);
                        return res.status(500).send('Error inserting request');
                    }
                    console.log('Inserted new request');
                    res.status(200).json({
                        message: 'Inserted new request',
                    });
                });
            }
        });
    });
});


const port = process.env.PORT || 3000;
app.listen(port, function () {
    console.log("Server is ready at " + port);
});
