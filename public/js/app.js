(function($){

window.onhashchange = function(evt){
	var hash = evt.target.location.hash.split('/');
	if(hash.length == 1){
		updateContent('pages/front.html');
	}
	else{
		var event = new CustomEvent(hash[1], {"detail": hash});
		document.dispatchEvent(event);
	}
};

document.addEventListener('program', function(e){
	if(e.detail.length == 3){
		updateContent('pages/' + e.detail[2] + '.html');
	}
	else if(e.detail[3] == "form"){
		var event = new CustomEvent("form", {"detail": e.detail});
		document.dispatchEvent(event);
	}
});

document.addEventListener('form', function(e){
	makeForm(e.detail[4]);
});

var updateContent = function(newContent, cb){
	if(typeof cb == "undefined") cb = function(){return;};
	$.get(newContent, function(data){
		$('#content').fadeOut(89, function(){$(this).html(data).fadeIn(89);cb();});
	});
};

var makeForm = function(formName){
	var hash = window.location.hash.split("/");
	updateContent('forms/'+formName+'.html', function(){
		$('#back').attr('href', hash[0] + "/" + hash[1] + "/" + hash[2]);
		updateDateTime();
	});
};

var multiForms = {}; //stores states we be at for each multiform encountered
document.addEventListener('form-ready', function(e){
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
			progress[hash[2]] = 0;
			multiForms[e.detail.name] = progress;
		}
		else if(typeof multiForms[e.detail.name][hash[2]] == "undefined"){
			multiForms[e.detail.name][hash[2]] = 0;
		}
		var event = new CustomEvent('multi-change', {"detail": {"state": multiForms[e.detail.name][hash[2]], "name": hash[4], "program": hash[2]}});
		document.getElementById(e.detail.name).dispatchEvent(event);
	}
	else{
		setupValidationHandlers(e.detail.name);
		setupBadInputPrevention(e.detail.name);
	}
});

document.addEventListener('multi-change', function(e){ //multiforms emit this type of event when they are done a certain task
	multiForms[e.detail.name][e.detail.program] = e.detail.state; //update state globals to save position
	var event = new CustomEvent('multi-change', {"detail": e.detail}); 
	document.getElementById(e.detail.name).dispatchEvent(event); //every multiform will need to be wrapped in a div with the id of its name to work
});

document.addEventListener('multi-state-ready', function(e){ //multiforms emit this type of event after they finish loading a new state
	updateDateTime();
	setupValidationHandlers(e.detail.id);
	setupBadInputPrevention(e.detail.id);
});

var setupValidationHandlers = function(formName){
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
					$("<button id='revise'>Revise</button>").hide().fadeIn(89).insertBefore($('#back')).click(function(){ //revise handler
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
				$("<button id='submit'>Submit</button>").hide().fadeIn(89).insertAfter($('#revise')).click(function(){ //final submit handler
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
								console.log(data.success);
								$('#content').fadeOut(89, function(){
									$(this).html("Data submitted successfully").fadeIn(89).delay(800).fadeOut(89, function(){
										var hash = window.location.hash.split("/");
										window.location.hash = hash[0] + "/" + hash[1] + "/" + hash[2];
									});
								});
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
			$('form label').each(function(i, label){ //show the user what they submitted
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
};

var setupBadInputPrevention = function(formName){
	var getSpecialInts = function(specials){
		var ints = [];
		for(var item in specials){
			switch(specials[item]){
				case "pos":
					ints.push(173);
					break;
				case "int":
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