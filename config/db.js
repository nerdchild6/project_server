const mysql = require('mysql2');

const con = mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '',
    database: 'borrow_movie'
});
//don't forgot this below 
module.exports = con;