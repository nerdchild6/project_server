const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const app = express();
const con = require('./config/db');
const bcrypt = require('bcrypt');
const { request } = require('http');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const JWT_KEY = 'm0bile2Simple';

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

//-------------------------- JWT decode -----------------------
app.get('/username', function (req, res) {
    // get token
    let token = req.headers['authorization'] || req.headers['x-access-token'];
    if (token == undefined || token == null) {
        // no token
        return res.status(400).send('No token');
    }
    // token found, extract token
    if (req.headers.authorization) {
        const tokenString = token.split(' ');
        if (tokenString[0] == 'Bearer') {
            token = tokenString[1];
        }
    }
    // verify token
    jwt.verify(token, JWT_KEY, (err, decoded) => {
        if (err) {
            return res.status(400).send('Incorrect token');
        }
        res.send(decoded);
    });
});


//======================================== STUDENT =============================================

//---------------- input login -------------
app.post('/login', function (req, res) {
    const username = req.body.username;
    const raw_password = req.body.password;

    const sql = "SELECT user_id, username, password, role, user_name, email FROM user WHERE username=?";
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
                const user_name = results[0].user_name;
                const email = results[0].email;
                const user_id = results[0].user_id;
                // res.send(results[0]);

                // console.log('student');
                const payload = {"user_id": user_id, "username": username, "role": role, "user_name": user_name, "email": email };
                const token = jwt.sign(payload, JWT_KEY, { expiresIn: '1d' });
                return res.send(token);

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
            res.status(200).send('User registered successfully');
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
        const borrower_id = results[0].user_id;

        const same_today = "SELECT * FROM request WHERE borrower_id = ? AND borrow_date = CURRENT_DATE AND (approve_status = 'pending' OR approve_status = 'approved')";
        con.query(same_today, [borrower_id], (err, results) => {
            if (err) {
                console.error('Error querying database:', err);
                res.status(500).json({ error: 'Error querying database' });
                return;
            }
            if (results.length > 0) {
                return res.status(200).send('can borrow only one movie per day');
            } else {
                const insert_request = "INSERT INTO request (asset_id, borrower_id, borrow_date, return_date, approve_status) VALUES (?, ?, CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY), 'pending')";
                con.query(insert_request, [asset_id, borrower_id], (err, result) => {
                    if (err) {
                        console.error('Error inserting request:', err);
                        return res.status(500).send('Error inserting request');
                    }
                    const Change_status_asset = "UPDATE asset SET asset_status = 'pending' WHERE asset_id = ?";
                    con.query(Change_status_asset, [asset_id], (err, result) => {
                        if (err) {
                            console.error('Error inserting request:', err);
                            return res.status(500).send('Error Changing status request');
                        }
                        const search_request_id = "SELECT request_id FROM request WHERE borrower_id = ? AND asset_id = ? ORDER BY request_id DESC LIMIT 1";
                        con.query(search_request_id, [borrower_id, asset_id], function (err, results) {
                            if (err) {
                                console.error(err);
                                return res.status(500).send('Server error');
                            }
                            if (results.length === 0) {
                                return res.status(404).send('Request_id not found');
                            }
                            //get request_id
                            const request_id = results[0].request_id;

                            const insert_history = "INSERT INTO history (asset_id, borrower_id, request_id) VALUES (?, ?, ?)";
                            con.query(insert_history, [asset_id, borrower_id, request_id], (err, result) => {
                                if (err) {
                                    console.error('Error inserting request:', err);
                                    return res.status(500).send('Error inserting history request');
                                }
                                console.log('Inserted new request');
                                res.status(200).json({
                                    message: 'Inserted new request',
                                });

                            });

                        });

                    });
                });
            }
        });
    });
});

//--------------- get recent borrow request from database of that user-----------
app.get('/request/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    const sql = `SELECT request.*, user.user_name, asset.asset_name FROM request JOIN user ON request.borrower_id = user.user_id JOIN asset ON request.asset_id = asset.asset_id WHERE borrower_id = ? ORDER BY request.request_id DESC LIMIT 1`;
    con.query(sql, user_id, (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            res.status(500).json({ error: 'Error querying database' });
            return;
        }
        res.json(results);
    });
});

//--------------- user history -----------
app.get('/history/:user_id', (req, res) => {
    const user_id = req.params.user_id;

    const sql = `
        SELECT 
            asset.asset_name, 
            asset.file_path, 
            u1.username AS approver_name, 
            u1.user_id AS approver_id,
            u2.username AS admin_name,
            u2.user_id AS admin_id,
            u3.username AS borrower_name,
            u3.user_id AS borrower_id,
            request.borrow_date,
            request.return_date,
            request.approve_status,
            history.history_id
        FROM 
            history 
            JOIN asset ON history.asset_id = asset.asset_id 
            LEFT JOIN user AS u1 ON history.approved_by = u1.user_id
            LEFT JOIN user AS u2 ON history.returned_by = u2.user_id
            LEFT JOIN user AS u3 ON history.borrower_id = u3.user_id
            JOIN request ON history.request_id = request.request_id
        WHERE 
            history.borrower_id = ?
        ORDER BY 
            history.history_id DESC;
    `;
    con.query(sql, user_id, (error, results) => {
        if (error) {
            console.error('Database error while fetching booking history:', error);
            return res.status(500).json({ error: 'Database error', details: error.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'No booking history found' });
        }
        console.log("Booking History Data:", results);
        res.json(results);
    });

});

//======================================== ADMIN, APPROVER =============================================

// ----------------- add asset -------------------
app.post('/asset', function (req, res) {
    const { asset_name, file_path, categorie } = req.body;

    const sql = "INSERT INTO  asset( asset_name, asset_status, file_path, categorie) VALUES (?, 'available', ?, ?)";
    con.query(sql, [asset_name, file_path, categorie], function (err, result) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error2');
        }
        console.log("Add data successfully");
        res.status(200).send({ message: 'Data added successfully' }); // Send a success response
    });
});

// ----------------- edit asset data -------------------
app.put('/asset/:asset_id/edit', function (req, res) {
    const asset_id = req.params.asset_id;
    const { asset_name, file_path, categorie } = req.body;

    const sql = "UPDATE asset SET asset_name = ?, file_path = ?, categorie = ? WHERE asset_id = ?";
    con.query(sql, [asset_name, file_path, categorie, asset_id], function (err, result) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.status(200).json({ message: "Edit data successfully" });
        // res.redirect(301, '/roomSta');
    });
});

// ------------- enable/disable asset --------------
app.put('/asset/:asset_id/disable', function (req, res) {
    const asset_status = req.body.asset_status;
    const sql = "UPDATE asset SET asset_status=? WHERE asset_id=?";
    con.query(sql, [asset_status, req.params.asset_id], function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send("Database server error");
        }
        if (results.affectedRows != 1) {
            return res.status(500).send("Update error");
        }
        res.send('Asset disable/enable status updated!');
    });
});

// ----------------dashboard---------------
app.get('/dashboard', function (req, res) {
    const sql = "SELECT asset_status, COUNT(*) AS count FROM asset GROUP BY asset_status UNION SELECT 'Total', COUNT(*) FROM asset";
    con.query(sql, function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        console.log(results)
        res.json(results);
    });
});

//---------------- get list of not_return asset ----------------
app.get('/return', function (req, res) {
    const sql = "SELECT * FROM asset WHERE asset_status = 'borrowed'";
    con.query(sql, function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

// ------------- admin click return asset --------------
app.put('/asset/:request_id/return', function (req, res) {
    const returned_by = req.body.returned_by;
    const request_id = req.params.request_id;

    const sql1 = "SELECT asset.asset_id FROM request JOIN asset ON request.asset_id = asset.asset_id WHERE request.request_id=?";
    con.query(sql1, request_id, function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send("Database server error");
        }

        if (results.length === 0) {  // Only check `results.length` for SELECT queries
            return res.status(404).send("asset_id not found");
        }

        // Assign the asset_id from the results
        const assetId = results[0].asset_id;
        console.log("Fetched assetId:", assetId);

        const sql2 = "UPDATE request SET return_status='returned' WHERE request_id=?";
        con.query(sql2, request_id, function (err, results) {
            if (err) {
                console.error(err);
                return res.status(500).send("Database server error");
            }

            console.log("Update request affected rows:", results.affectedRows);
            if (results.affectedRows != 1) {
                return res.status(500).send("Update error1");
            }

            const sql3 = "UPDATE asset SET asset_status='available' WHERE asset_id=?";
            con.query(sql3, assetId, function (err, results) {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Database server error");
                }

                console.log("Update asset affected rows:", results.affectedRows);
                if (results.affectedRows != 1) {
                    return res.status(500).send("Update error1");
                }

                const sql4 = "UPDATE history SET returned_by=? WHERE request_id=?";
                con.query(sql4, [returned_by, request_id], (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send("Database server error");
                    }

                    console.log("Update history affected rows:", results.affectedRows);
                    if (results.affectedRows != 1) {
                        return res.status(500).send("Update error4");
                    }

                    res.send('Return Asset!!');
                });
            });
        });
    });
});

//---------------- get list of borrow asset request ----------------
app.get('/request', function (req, res) {
    const sql = "SELECT request.*, asset.asset_name FROM request JOIN asset ON request.asset_id = asset.asset_id";
    con.query(sql, function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

//---------------- approver click approve request ------------------------
app.put('/request/:request_id/approve', function (req, res) {
    const approved_by = req.body.approved_by;
    const request_id = req.params.request_id;

    const sql1 = "SELECT asset.asset_id FROM request JOIN asset ON request.asset_id = asset.asset_id WHERE request.request_id=?";
    con.query(sql1, request_id, function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send("Database server error");
        }

        if (results.length === 0) {  // Only check `results.length` for SELECT queries
            return res.status(404).send("asset_id not found");
        }

        // Assign the asset_id from the results
        const assetId = results[0].asset_id;
        console.log("Fetched assetId:", assetId);

        const sql2 = "UPDATE request SET return_status='not_returned', approved_by=?, approve_status='approved' WHERE request_id=?";
        con.query(sql2, [approved_by, request_id], function (err, results) {
            if (err) {
                console.error(err);
                return res.status(500).send("Database server error");
            }

            console.log("Update request affected rows:", results.affectedRows);
            if (results.affectedRows != 1) {
                return res.status(500).send("Update error1");
            }

            const sql3 = "UPDATE asset SET asset_status='borrowed' WHERE asset_id=?";
            con.query(sql3, assetId, function (err, results) {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Database server error");
                }

                console.log("Update asset affected rows:", results.affectedRows);
                if (results.affectedRows != 1) {
                    return res.status(500).send("Update error1");
                }

                const sql4 = "UPDATE history SET approved_by=? WHERE request_id=?";
                con.query(sql4, [approved_by, request_id], (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send("Database server error");
                    }

                    console.log("Update history affected rows:", results.affectedRows);
                    if (results.affectedRows != 1) {
                        return res.status(500).send("Update error4");
                    }

                    res.send('Approve Asset!!');
                });
            });
        });
    });
});

//---------------- approver click reject request ------------------------
app.put('/request/:request_id/reject', function (req, res) {
    const approved_by = req.body.approved_by;
    const request_id = req.params.request_id;

    const sql1 = "SELECT asset.asset_id FROM request JOIN asset ON request.asset_id = asset.asset_id WHERE request.request_id=?";
    con.query(sql1, request_id, function (err, results) {
        if (err) {
            console.error(err);
            return res.status(500).send("Database server error");
        }

        if (results.length === 0) {  // Only check `results.length` for SELECT queries
            return res.status(404).send("asset_id not found");
        }

        // Assign the asset_id from the results
        const assetId = results[0].asset_id;
        console.log("Fetched assetId:", assetId);

        const sql2 = "UPDATE request SET approved_by=?, approve_status='rejected' WHERE request_id=?";
        con.query(sql2, [approved_by, request_id], function (err, results) {
            if (err) {
                console.error(err);
                return res.status(500).send("Database server error");
            }

            console.log("Update request affected rows:", results.affectedRows);
            if (results.affectedRows != 1) {
                return res.status(500).send("Update error1");
            }

            const sql3 = "UPDATE asset SET asset_status='available' WHERE asset_id=?";
            con.query(sql3, assetId, function (err, results) {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Database server error");
                }

                console.log("Update asset affected rows:", results.affectedRows);
                if (results.affectedRows != 1) {
                    return res.status(500).send("Update error1");
                }

                const sql4 = "UPDATE history SET approved_by=? WHERE request_id=?";
                con.query(sql4, [approved_by, request_id], (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send("Database server error");
                    }

                    console.log("Update history affected rows:", results.affectedRows);
                    if (results.affectedRows != 1) {
                        return res.status(500).send("Update error4");
                    }

                    res.send('Reject Asset!!');
                });
            });
        });
    });
});

const port = process.env.PORT || 3000;
app.listen(port, function () {
    console.log("Server is ready at " + port);
});
