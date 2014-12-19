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
			console.log("bad request " + util.inspect(form));
			res.write(JSON.stringify({error:"Couldn't read form"}));
			res.end();
		}
		else{
			var theForm;
			var connection = mysql.createConnection(db);
			connection.connect();
			if(theForm = inserts[req.query.form]){
				var post = {};
				var msg = {};
				var obs_num = -1;
				var doInserts = function(x){
					post = {};
					if(theForm.inserts[x].table == "obs_site"){
						connection.query("SELECT obs_num FROM obs_site ORDER BY obs_num DESC LIMIT 1", function(err, rows, fields){
							if(err) console.log("Error fetching obs_num");
							else obs_num = rows[0].obs_num + "";
						});
					}
					for(var j in theForm.inserts[x].pairings){
						if(j == "date"){
							var now = new Date();
							var dateString = now.getFullYear() + "-";
							dateString += now.getMonth()+1 + "-";
							dateString += now.getDate();
							post[j] = dateString;
						}
						else if(j == "obs_num"){
							post[j] = obs_num;
						}
						else{
							post[j] = fields[theForm.inserts[x].pairings[j]];
						}
					}
					connection.query('INSERT INTO ' + theForm.inserts[x].table + ' SET ?', post, function(err, result){
						if(err){
							console.log("bad query " + util.inspect(post));
							msg.error += "Post failed ";
						}
						else{
							console.log(theForm.inserts[x].table + " updated successfully");
							msg.success += "Database updated ";
						}
						if(x > 0){
							doInserts(x - 1);
						}
						else{
							connection.end();
							res.write(JSON.stringify(msg));
							res.end();
						}
					});
				}
				var i = theForm.inserts.length - 1;
				doInserts(i);
			//	for(var i in theForm.updates){
			//		poo = theForm.updates[i];
			//		post = {};
			//		for(var j in poo.pairings){
			//			post[j] = fields[poo.pairings[j]];
			//		}
			//		connection.query('INSERT INTO ' + poo.table + ' SET ?', post, function(err, result){
			//			if(err){
			//				console.log("bad query " + util.inspect(post));
			//			//	res.write(JSON.stringify({error:"Post failed"}));
			//				msg.error[poo.table] = "Post failed";
			//			}
			//			else{
			//				console.log(poo.table + " updated successfully");
			//			//	res.write(JSON.stringify({success:"Database updated"}));
			//				msg.success[poo.table] = "Database updated";
			//			}
			//		});
			//	}
			//	connection.end();
			//	res.end(JSON.stringify(msg));
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