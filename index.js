var express = require('express');
var app = express();
var http = require('http').Server(app);
var path = require('path');
var formidable = require('formidable');
var util = require('util');
var mysql = require('mysql');

var db = require('./connection'); //db connection info
var inserts = require('./inserts'); //this file tells the forms how to update the database

app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/index.html');
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/form', function(req, res){
	console.log(util.inspect(req.query));
	var form = new formidable.IncomingForm();
	form.encoding = 'utf-8';
	form.parse(req, function(error, fields, files) {
		if(error){
			console.log("bad query " + util.inspect(form));
			res.write(JSON.stringify({error:"Couldn't read form"}));
			res.end();
		}
		else{
			var connection = mysql.createConnection(db);
			connection.connect();
			var post = {};
			if(inserts[req.query.form]){
				for(var i in inserts[req.query.form].pairings){
					post[i] = fields[inserts[req.query.form].pairings[i]];
				}
				connection.query('INSERT INTO ' + inserts[req.query.form].table + ' SET ?', post, function(err, result){
					if(err){
						console.log("bad query " + util.inspect(post));
						res.write(JSON.stringify({error:"Post failed"}));
					}
					else{
						console.log(inserts[req.query.form].table + " updated successfully");
						res.write(JSON.stringify({success:"Database updated"}));
					}
					connection.end();
					res.end();
				});
			}
			else{
				console.log("Form processing failed, inserts not defined for " + req.query.form);
				connection.end();
				res.write(JSON.stringify({error:"Post failed"}));
				res.end();
			}
		}
	});
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});