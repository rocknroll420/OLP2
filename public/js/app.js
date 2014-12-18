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
		$('#content').fadeOut(110, function(){$(this).html(data).fadeIn(110);cb();});
	});
};

var makeForm = function(formName){
	updateContent('forms/'+formName+'.html', function(){
		var hash = window.location.hash.split("/");
		$('#back').attr('href', hash[0] + "/" + hash[1] + "/" + hash[2]);
		updateDateTime();
		setupValidationHandlers(formName);
	});
};

var setupValidationHandlers = function(formName){
	$('#'+formName).validate({
		submitHandler: function(form){
			$('#review').fadeOut(110, function(){
				$("<formline />").insertBefore($('#back')).append(
					$("<button id='revise'>Revise</button>").hide().fadeIn(110).insertBefore($('#back')).click(function(){
						$('#revise, #submit').each(function(){$(this).fadeOut(110, function(){$(this).remove();$('#review').fadeIn(110)})});
						var $labels = $('label');
						$labels.each(function(i){
							var $label = $(this);
							$(this).find('span').fadeOut(110, function(){
								$(this).remove();
								$('#'+$label.attr('for')).fadeIn(110);
							});
						});
					})
				);
				$("<button id='submit'>Submit</button>").hide().fadeIn(110).insertAfter($('#revise')).click(function(){
					var formURL = $('#'+formName).attr('action');
					var formData = new FormData($('#'+formName)[0]); 
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
								$('#content').fadeOut(110, function(){
									$(this).html("Data submitted successfully").fadeIn(110).delay(800).fadeOut(110, function(){
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
			$('form label').each(function(i, label){
				var val = $(this).attr('for');
				$('#'+val).fadeOut(110, function(){
					$("<span/>").text($(this).val()).hide().fadeIn(110).appendTo(label);
				});
			});
		}
	});
	//$('#' + formName + ' input').keyup(function(){
	//	$(this).valid();
	//});
};

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var updateDateTime = function(){
	var now = new Date();
	var day = now.getDate();
	day += " " + months[now.getMonth()];
	day += " " + now.getFullYear();
	var time = now.toLocaleTimeString();
	$('date').html("Date: " + day);
	$('time').html("Time: " + time);
};

$(document).ready(function(){
	updateContent('pages/front.html');
});
})(jQuery);