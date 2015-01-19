var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
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
		//console.log(fields); //debug
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
				var doTasks = function(){
					var buildPost = function(currentTask, iteration, cb){ //take the callback out of this it's not used or even called
						var post = {};
						if(!currentTask.repeat || typeof iteration == "undefined") iteration = false;
						if(typeof cb == "undefined") cb = function(){return;};
						if(currentTask.type == "insert"){
							for(var j in currentTask.pairings){
								if(j == "date"){
									var now = new Date();
									var dateString = now.getFullYear() + "-";
									dateString += now.getMonth()+1 + "-";
									dateString += now.getDate();
									post[j] = dateString;
								}
								else if(j == "obs_num" || currentTask.pairings[j] == "obs_num"){
									post[j] = selects["get_obs_num"];
									if(post[j] < 0){ //if we don't have the obs_num we try to get it again
										connection.query(form_sql.sql["get_obs_num"].query, function(err, rows, fields){
											post[j] = form_sql.sql["get_obs_num"].handler(err, rows, fields);
											selects["get_obs_num"] = post[j];
										});
									}
								}
								else{
									if(currentTask.repeat){
										var pairing = (typeof currentTask.pairings[j] == "string") ? currentTask.pairings[j].split('-') : [];
										if(pairing.length > 1){
											pairing[1] = iteration;
											pairing = pairing[0] + "-" + pairing[1] + "-" + pairing[2];
											post[j] = fields[pairing];
										}
										else{ //this one is taken from the same field each time
											post[j] = (typeof currentTask.pairings[j] == "number") ? currentTask.pairings[j] : fields[currentTask.pairings[j]]; //so we can set stuff to constant numbers
										}
									}
									else{
										post[j] = (typeof currentTask.pairings[j] == "number") ? currentTask.pairings[j] : fields[currentTask.pairings[j]]; //so we can set stuff to constant numbers
									}
								}
							}
						}
						else if(currentTask.type == "update"){
							var cols = [];
							var vals = [];
							for(var j in currentTask.pairings){
								cols.push(j);
								var val;
								if(j == "date"){
									var now = new Date();
									var dateString = now.getFullYear() + "-";
									dateString += now.getMonth()+1 + "-";
									dateString += now.getDate();
									val = dateString;
								}
								else if(j == "obs_num" || currentTask.pairings[j] == "obs_num"){ 
									val = selects["get_obs_num"];
									if(val < 0){ //if we don't have the obs_num we try to get it again
										connection.query(form_sql.sql["get_obs_num"].query, function(err, rows, fields){
											form_sql.sql["get_obs_num"].handler(err, rows, fields, function(res){
												val = res;
												selects["get_obs_num"] = val;
											});
										});
									}
								}
								else{
									val = fields[currentTask.pairings[j]];
								}
								vals.push(val);
							}
							post = {cols: cols, vals: vals};
						}
						else post = {};
						return post;
					};
					var doTask = function(x, repeat, repeats){
						if(x >= theForm.tasks.length || x < 0){console.log("Bad task index " + x); return;} //in case some bad shit happens
						post = {};
						var currentTaskName = theForm.tasks[x];
						var currentTask = form_sql.sql[currentTaskName];
						if(currentTask.repeat){ //check for initializing repeat stuff and quitting if we're in too deep
							if(typeof repeat == "undefined") repeat = 0;
							if(typeof repeats == "undefined") repeats = [];
							if(repeats.length < 1){ //init the repeat array
								repeats = fields[currentTask.repeat].split(","); //we stored the list of stuff we want to repeat in a hidden form field
							}
							if(repeat >= repeats.length) (++x < theForm.tasks.length) ? doTask(x) : endTasks(); //do next crap if we get in on a bad repeat index
						}
						switch(currentTask.type){
							case "insert":
								post = (currentTask.repeat) ? buildPost(currentTask, parseInt(repeats[repeat])) : buildPost(currentTask);
								connection.query('INSERT INTO ' + currentTask.table + ' SET ?', post, function(err, result){
									if(err){
										console.log("bad query for " + currentTaskName + util.inspect(post));
										if(!msg.error) msg.error = "";
										msg.error += "Post failed ";
									}
									else{
										console.log(currentTask.table + " inserted successfully");
										if(!msg.success) msg.success = "";
										msg.success += "Database updated ";
									}
									if(currentTask.repeat){//we might have to repeat a task
										if(repeat < repeats.length - 1){ //do it again if we haven't repeated enough
											doTask(x, ++repeat, repeats);
										}
										else{ //on to the next task if we have
											(++x < theForm.tasks.length) ? doTask(x) : endTasks();
										}
									}
									else{ //do next task if there is one
										(++x < theForm.tasks.length) ? doTask(x) : endTasks();
									}
								});
								break;
							case "update":
								post = buildPost(currentTask);
								//var query = "UPDATE " + currentTask.table + " SET ?? = ?? WHERE " + currentTask.where.where + " = ?";
								var query = "UPDATE " + currentTask.table + " SET "; //was having trouble getting the ?? syntax to escape properly so i did it myself
								for(var i in post.cols){
									if(i > 0) query += ", ";
									query += post.cols[i] + " = " + connection.escape(post.vals[i]);
								}
								query += " WHERE " + currentTask.where.where + " = " + connection.escape(fields[currentTask.where.is]);
								//connection.query(query , [post.cols, post.vals, fields[currentTask.where.is]], function(err, result){ 
								connection.query(query, function(err, result){
									if(err){ console.log("error updating " + currentTask.table);console.log(err);}
									else{console.log(currentTask.table + " updated successfully")}
									(++x < theForm.tasks.length) ? doTask(x) : endTasks();
								});
								break;
							case "select":
								connection.query(currentTask.query, function(err, rows, fields){
									currentTask.handler(err, rows, fields, function(res){
										if(currentTask.store){
											msg.store = res.store; //this should be rewritten to only overwrite matching keys
											selects[currentTaskName] = res.val;
										}
										else{
											selects[currentTaskName] = res;
										}
										(++x < theForm.tasks.length) ? doTask(x) : endTasks();
									});
								});
								break;
							default:
								console.log("Bad task request: " + currentTaskName);
								(++x < theForm.tasks.length) ? doTask(x) : endTasks();
								break;
						}
					};
					var endTasks = function(){
						connection.end();
						res.write(JSON.stringify(msg));
						res.end();
					};
					doTask(0);
				};
				doTasks();
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

app.get('/select', function(req, res){
	console.log(util.inspect(req.query));
	var select = (typeof form_sql.sql[req.query.s] == "object") ? form_sql.sql[req.query.s] : {type:"Nope"};
	if(select.type == "select"){
		var msg;
		var connection = mysql.createConnection(db);
		connection.connect();
		connection.query(select.query, function(err, rows, fields){
			if(err){
				console.log("Error selecting " + select.query);
				msg = {error:"Selection failed"};
			}
			else{
				console.log("Selected " + req.query.s);
				msg = select.handler(err, rows, fields);
				msg = {success:msg};
			}
			connection.end();
			res.end(JSON.stringify(msg));
		});
	}
	else{
		console.log("Nothing to select");
		res.end(JSON.stringify({error:"Nothing to select"}));
	}
});

var users = {};
io.on('connection', function(socket){
	users[socket.id] = {socket: socket, storage:{}};
	//help.printUsers(users);
	socket.on('disconnect', function(data){
		delete users[socket.id];
		//help.printUsers(users);
	});
	socket.on('store', function(data){
		if(!data.form || !data.program || !data.data) return; //junk request
		if(!users[socket.id].storage[data.form]) users[socket.id].storage[data.form] = {};
		if(!users[socket.id].storage[data.form][data.program]) users[socket.id].storage[data.form][data.program] = {};
		for(var item in data.data){
			users[socket.id].storage[data.form][data.program][item] = data.data[item];
		}
	});
	socket.on('unstore', function(data){ //UNTESTED
		if(!data.form || !data.program || !data.data) return; //junk request
		for(var item in data.data){
			if(typeof users[socket.id].storage[data.form][data.program][item] != "undefined") delete users[socket.id].storage[data.form][data.program][item];
		}
	});
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

var help = {
	printUsers: function(users){
		var users_string = "Sockets: {";
		for(var id in users){
			users_string += "\n\t"+id+", ";
		}
		users_string = users_string.substring(0, users_string.length - 2);
		users_string += "\n}";
		console.log(users_string);
	}	
};