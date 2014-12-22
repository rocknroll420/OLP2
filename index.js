var express = require('express');
var app = express();
var http = require('http').Server(app);
var path = require('path');
var formidable = require('formidable');
var util = require('util');
var mysql = require('mysql');

var db = require('./connection'); //db connection info
var form_sql = require('./form-sql'); //form processing procedures and required sql

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
			console.log("bad request " + util.inspect(form));
			res.write(JSON.stringify({error:"Couldn't read form"}));
			res.end();
		}
		else{
			var theForm;
			var connection = mysql.createConnection(db);
			connection.connect();
			if(theForm = form_sql.forms[req.query.form]){
				var post = {};
				var msg = {};
				var selects = {};
				var doTasks = function(x){
					if(x >= theForm.tasks.length || x < 0){console.log("Bad task index " + x); return;} //in case some bad shit happens
					post = {};
					var currentTaskName = theForm.tasks[x];
					var currentTask = form_sql.sql[currentTaskName];
					var doRecursion = function(){ //call again, or end
						if(x++ < theForm.tasks.length - 1){
							doTasks(x);
						}
						else{
							connection.end();
							res.write(JSON.stringify(msg));
							res.end();
						}
					};
					if(currentTask.type == "select"){
						connection.query(currentTask.query, function(err, rows, fields){
							selects[currentTaskName] = currentTask.handler(err, rows, fields);
							doRecursion();
						});
					}
					else if(currentTask.type == "insert"){
						for(var j in currentTask.pairings){
							if(j == "date"){
								var now = new Date();
								var dateString = now.getFullYear() + "-";
								dateString += now.getMonth()+1 + "-";
								dateString += now.getDate();
								post[j] = dateString;
							}
							else if(j == "obs_num"){
								post[j] = selects["get_obs_num"];
								if(post[j] < 0){ //if we don't have the obs_num we try to get it again
									connection.query(form_sql.sql["get_obs_num"].query, function(err, rows, fields){
										post[j] = form_sql.sql["get_obs_num"].handler(err, rows, fields);
										selects["get_obs_num"] = posts[j];
									});
								}
							}
							else{
								post[j] = fields[currentTask.pairings[j]];
							}
						}
						connection.query('INSERT INTO ' + currentTask.table + ' SET ?', post, function(err, result){
							if(err){
								console.log("bad query " + util.inspect(post));
								msg.error += "Post failed ";
							}
							else{
								console.log(currentTask.table + " updated successfully");
								msg.success += "Database updated ";
							}
							doRecursion();
						});
					}
				}
				doTasks(0);
			}
			else{
				console.log("Form processing failed, " + req.query.form + " not defined");
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