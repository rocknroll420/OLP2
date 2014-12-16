(function($){
	$(document).ready(function(){
		$.get('forms/welcomeAboard.html', function(data){
			$('#content').html(data);
		});
	});
})(jQuery);