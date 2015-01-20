(function($){

var socket = io(); //get the socket.io going
var storage = {}; //holds on to whatever you want

//HASH CHANGE STUFF
window.onhashchange = function(evt){
	var hash = evt.target.location.hash.split('/');
	if(hash.length == 1){ //no hash is front page
		updateContent('pages/front.html');
	}
	else{ 
		var event = new CustomEvent(hash[1], {"detail": hash}); //fire an event on the first part of the hash and it should cascade through the whole hash
		document.dispatchEvent(event);
	}
};

document.addEventListener('program', function(e){ //select a program
	if(e.detail.length == 3){ //only load it if we're not deeper into the site
		updateContent('pages/' + e.detail[2] + '.html');
	}
	else if(e.detail[3] == "form"){ //usually we really wanted a form
		var event = new CustomEvent("form", {"detail": e.detail});
		document.dispatchEvent(event);
	}
});

document.addEventListener('form', function(e){ //load a form
	makeForm(e.detail[4]);
});

document.addEventListener('test', function(e){ //loads the test page. remove later
	makeForm("test");
});
//NOT HASH CHANGE STUFF

var updateContent = function(newContent, cb){ //update everything on the page to a new file
	if(typeof cb == "undefined") cb = function(){return;};
	$.get(newContent, function(data){
		$('#content').fadeOut(89, function(){$(this).html(data).fadeIn(89);cb();});
	});
};

var makeForm = function(formName){ //really the handler for a form hashchange
	var hash = window.location.hash.split("/");
	updateContent('forms/'+formName+'.html', function(){
		$('#back').attr('href', hash[0] + "/" + hash[1] + "/" + hash[2]);
		updateDateTime();
	});
};

var multiForms = {}; //stores states we be at for each multiform encountered
document.addEventListener('form-ready', function(e){ //forms emit this when they fully load 
	var hash = window.location.hash.split("/");
	if(typeof hash[2] == "string"){
		switch(hash[2]){
			case "AIS":
				$('#module').val(1);
				$('#section-title').html("Field Program: Monitoring of Aquatic Invasive Species");
				break;
			case "ecosys":
				$('#module').val(2);
				$('#section-title').html("Field Program: Coastal Ecosystem Monitoring and Sustainable Fisheries Research");
				break;
			case "wolffish":
				$('#module').val(3);
				$('#section-title').html("Field Program: Mapping Nearshore Habitat for Atlantic Wolffish");
				break;
		}
	}
	if(e.detail.isMulti){
		if(typeof multiForms[e.detail.name] == "undefined"){
			var progress = {};
			progress[hash[2]] = {state: 0, data: {}};
			multiForms[e.detail.name] = progress;
		}
		else if(typeof multiForms[e.detail.name][hash[2]] == "undefined"){
			multiForms[e.detail.name][hash[2]] = {state: 0, data: {}};
		}
		var event = new CustomEvent('multi-change', {"detail": {"state": multiForms[e.detail.name][hash[2]].state, "name": hash[4], "program": hash[2], "firstRun": true}}); //firstRun keeps the form from fading in instantly again when the specific multi-form is loaded from the multi-form start page 
		document.getElementById(e.detail.name).dispatchEvent(event);
	}
	else{
		setupValidationHandlers(e.detail.name);
		setupBadInputPrevention(e.detail.name);
	}
});

document.addEventListener('multi-change', function(e){ //multiforms emit this type of event when they are done a certain task
	multiForms[e.detail.name][e.detail.program]["state"] = e.detail.state; //update state globals to save position
	var event = new CustomEvent('multi-change', {"detail": e.detail}); 
	document.getElementById(e.detail.name).dispatchEvent(event); //every multiform will need to be wrapped in a div with the id of its name to work
});

document.addEventListener('multi-state-ready', function(e){ //multiforms emit this type of event after they finish loading a new state
	updateDateTime();
	setupValidationHandlers(e.detail.id);
	setupBadInputPrevention(e.detail.id);
	populateFieldsWithStorage(e.detail.id);
});

var setupValidationHandlers = function(formName){ //error messages and form submission
	$('#'+formName).validate({
		submitHandler: function(form){
			var formSel = '#' + formName;
			if($('#latdeg').length > 0){ //copy the lat&lon to decimal format field
				var lat = parseInt($('#latdeg').val()) + parseInt($('#latmin').val())/60;
				var lon = parseInt($('#londeg').val()) + parseInt($('#lonmin').val())/60;
				$('#lat').val(lat);
				$('#lon').val(lon);
			}
			$(formSel).find('input[time]').each(function(){ //make the time into a HH:MM string and put it in the hidden field
				var $for = $('#'+$(this).attr('for'));
				var t = ($(this).val().length > 1) ? $(this).val() : ($(this).val().length == 1) ? "0"+$(this).val() : "00";
				($(this).attr('time') == "hr") ? $for.val(t + ":") : $for.val($for.val() + t);
			});
			$('#review').fadeOut(89, function(){ //put in the new buttons
				$("<formline />").insertBefore($('#back')).append(
					//revise handler
					$("<button id='revise'>Revise</button>").hide().fadeIn(89).insertBefore($('#back')).click(function(){ 
						$('#revise,  #submit').each(function(){$(this).fadeOut(89, function(){$(this).remove();$(formSel +' #review').fadeIn(89)})});
						var $labels = $('label');
						$labels.each(function(i){
							var $label = $(this);
							if($(this).attr('type') == "radio" || $(this).attr('type') == "checkbox"){
								var $radio = $(this).attr('for');
								$radio = $('#'+$radio);
								if($radio.prop('checked')){
									$radio.unbind('click');
								}
								else{
									$radio.removeClass('faded').prop('disabled', false);
									$(this).removeClass('faded');
								}
							}
							else{
								$(this).find('span').fadeOut(89, function(){
									$(this).remove();
									if($label.attr('type') == "count"){
										var i = $label.attr('for').split("-")[1];
										if($('#ais-'+i+'-yes').prop('checked')){
											$('#ais-'+i+'-cnt').fadeIn(89);
										}
									}
									else{
										$('#'+$label.attr('for')).fadeIn(89);
									}
								});
							}
						});
					})
				);
				//final submit handler
				$("<button id='submit'>Submit</button>").hide().fadeIn(89).insertAfter($('#revise')).click(function(){ 
					var formURL = $(formSel).attr('action');
					var formData = new FormData($(formSel)[0]); 
					$.ajax({                                                    
						url: formURL,
						data: formData,
						type: 'POST',
						contentType: false,                       
						processData: false,                       
						success: function (data) {
							console.log(data);
							var data = JSON.parse(data);
							if(data.success){
								var hash = window.location.hash.split("/");
								if(data.store){
									//if(!storage[hash[4]]) storage[hash[4]] = {};
									//if(!storage[hash[4]][hash[2]]) storage[hash[4]][hash[2]] = {};
									//for(var item in data.store){
									//	storage[hash[4]][hash[2]][item] = data.store[item]; //locally store it
									//}
									//console.log(storage[hash[4]][hash[2]]);
									socket.emit('store', {form: hash[4], program: hash[2], data:data.store}); //ask the server to store this junk too (maybe not later dunno by)
								}
								if(multiForms[hash[4]] && multiForms[hash[4]][hash[2]]){ //if it is a multiform we know about
									$('#submit').parent().fadeOut(89, function(){$(this).remove()});
									$('#'+hash[4]).fadeOut(89, function(){
										$(this).html("Data submitted successfully").fadeIn(89).delay(800).fadeOut(89, function(){
											var newstate = (multiForms[hash[4]][hash[2]].state + 1) % parseInt($('#'+hash[4]).attr('states'));
											console.log(newstate);
											var event = new CustomEvent('multi-change', {"detail": {state:newstate, "name": hash[4], "program": hash[2]}}); //go to the next state
											document.dispatchEvent(event);
										});
									});
								}
								else{ //if it's a regular form
									$('#content').fadeOut(89, function(){ 
										$(this).html("Data submitted successfully").fadeIn(89).delay(800).fadeOut(89, function(){
											window.location.hash = hash[0] + "/" + hash[1] + "/" + hash[2]; //go to program overview
										});
									});
								}
							}
							else if(data.error){
								console.log(data.error);
							}
							else{
								console.log("Unknown error in submitting form");
							}
						},
						error: function (err) {
							console.log("ERROR getting data. Please try again… ");
						}
					});
				});
			});
			//stuff you actually see happen when clicking the "review" button starts here
			$('input[special]').each(function(j, input){ //does stuff with specials
				var specials = $(this).attr('special').split(" ");
				for(var item in specials){
					switch(specials[item]){
						case "pos":
							$(this).val($(this).val().replace(/[^0-9\.]/g,'')); //only decimal and 0-9 allowed
							break;
						case "int":
							$(this).val($(this).val().replace(/[^0-9\-]/g,'')); //only negative and 0-9 allowed
							break;
						default:
							break;
					}
					$(this).val($(this).val().replace(/[{}]/g,'')); //anyone actually doing this would just edit this script but hey
				}				
				if(j == $(this).length - 1){ //like a budget callback
					//show the user what they submitted
					$('form label').each(function(i, label){ 
						if($(this).attr('type') == "radio" || $(this).attr('type') == "checkbox"){
							var radio = $(this).attr('for');
							if($('#'+radio).prop('checked')){
								$('#'+radio).click(function(e){e.preventDefault();});
							}
							else{
								$('#'+radio).addClass('faded').prop('disabled', true);
								$(this).addClass('faded');
							}
						}
						else if($(this).attr('type') == "textarea"){
							var val = $(this).attr('for');
							$('#'+val).fadeOut(89, function(){
								$("<span class='textarea-span'/>").text($(this).val()).hide().fadeIn(89).appendTo(label);
							});
						}
						else{
							var val = $(this).attr('for');
							$('#'+val).fadeOut(89, function(){
								$("<span/>").text($(this).val()).hide().fadeIn(89).appendTo(label);
							});
						}
					});
				}
			});
		}
	});
};
//does stuff with specials as well... will have to change two things if any specials are added!!! if the feature expands beyond two types of specials it will be abstracted out
var setupBadInputPrevention = function(formName){ //prevents users from entering certain characters to an input element if "special" attr is set on the element. special can take a " " separated list of special attributes like a class. 
	var getSpecialInts = function(specials){
		var ints = [];
		for(var item in specials){
			switch(specials[item]){
				case "pos": //positive number - prevents non-digits except decimal
					ints.push(173);
					break;
				case "int": //integer - prevents non-digits except for minus sign
					ints.push(190);
					break;
				default:
					break;
			}
		}
		return ints;
	};
	$('#'+formName+' input').each(function(){
		if($(this).attr('type') == "number"){
			$(this).keydown(function(e){
				var specials = false;
				if(typeof $(this).attr('special') != "undefined"){
					specials = $(this).attr('special').split(" ");
				}
				if(!shift && (e.which == 173 || e.which == 190 || (e.which >= 48 && e.which <= 57) || e.which == 8 || e.which == 9)){
					if(specials){
						var ints = getSpecialInts(specials);
						if(ints.indexOf(e.which) > -1){
							e.preventDefault();
							return false;
						}
					}
					return true;
				}
				e.preventDefault();
				return false;
			});
		}
	});
};

var populateFieldsWithStorage = function(id){ //inputs with stored values (indicated with a "stored" attr) have their values filled in from the global storage object we're using 
	var hash = window.location.hash.split("/");
	var store = [];
	$('#'+id).find('input[stored]').each(function(i){
		if($(this).val() == ""){
			var field = $(this).attr('stored');
			if(storage[hash[4]] && storage[hash[4]][hash[2]] && storage[hash[4]][hash[2]][field]) $(this).val(storage[hash[4]][hash[2]][field]);
			else store.push(field);
		}
		if(i == $(this).length - 1){
			if(store.length > 0) socket.emit('getStore', {form:hash[4], program:hash[2], store:store});
		}
	});
};

//socket.io stuff
socket.on('getStore', function(res){ //try to get a saved value from the server... might replace the local storage all together with this eventually
	console.log(res);
	var hash = window.location.hash.split("/");
	if(res.success && res.program == hash[2] && res.form == hash[4]){
		for(var item in res.success){ //fill up the fields
			$('#'+item).val(res.success[item])//this assumes the stored item's name and the field id are the same. this isn't necessarily true
			if(!storage[hash[4]]) storage[hash[4]] = {};
			if(!storage[hash[4]][hash[2]]) storage[hash[4]][hash[2]] = {};
			storage[hash[4]][hash[2]][item] = res.success[item]
		}
	}
});
//end socket.io stuff

//general stuff
var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; 
var updateDateTime = function(){ //date formatting
	var now = new Date();
	var day = now.getDate();
	day += " " + months[now.getMonth()];
	day += " " + now.getFullYear();
	var time = now.toLocaleTimeString();
	if($('date').length < 1) console.log("no date");
	$('date').html("Date: " + day);
	$('time').html("Time: " + time);
};

var shift = false; //so we know if shift is down
$(document).keydown(function(e){
	if(e.which == 16) shift = true;
}).keyup(function(e){
	if(shift && e.which == 16) shift = false;
});

$(document).ready(function(){ //init
	var hash = window.location.hash.split('/');
	if(hash.length == 1){
		updateContent('pages/front.html');
	}
	else{
		var event = new CustomEvent(hash[1], {"detail": hash});
		document.dispatchEvent(event);
	}
});
})(jQuery);