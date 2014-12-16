var express = require('express');
var app = express();
var http = require('http').Server(app);
var path = require('path');
var formidable = require('formidable');
var util = require('util');
var mysql = require('mysql');

var db = require('./connection');

app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/index.html');
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/form/welcome', function(req, res){
	console.log('form/welcome');
	var form = new formidable.IncomingForm();
	form.encoding = 'utf-8';
	form.parse(req, function(error, fields, files) {
		var connection = mysql.createConnection({
			host: db.host,
			user: db.user,
			password: db.password,
			database: db.db
		});
		connection.connect();
		var post = {
			module: fields.module,
			vessel_name: fields.vessel,
			school_name: fields.school,
			teacher_name: fields.teacher_name,
			waterbody: fields.waterBody,
			weather:fields.weather
		};
		connection.query('INSERT INTO trip SET ?', post, function(err, result){
			if(err) console.log("fucked up query "+ util.inspect(err));
		});
		connection.end();
	});

	res.write(JSON.stringify({hey:"hey"}));
	res.end();
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});