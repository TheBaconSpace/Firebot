const shell = require('electron').shell;

// Random BG Image
function randomBG(){
    var random = Math.floor(Math.random() * 5) + 1 ;
    $('body').css('background-image', 'url("./images/bg/'+random+'.jpg")');
}
randomBG();

// Toggles the side menu.
function startMenu(){
    $('.menu-toggle').sidr({
        name: 'main-menu',
        source: '#main-menu',
        renaming: false
    });
}
startMenu();

// Navigates between various main pages.
function pageNavigation(){
    $('.navigation a, .nav').click( function(e) {
        e.preventDefault(); 
        var nextup = $(this).attr('data');
        $('.current').slideToggle(500).removeClass('current');
        $('.'+nextup).slideToggle(500).addClass('current');
        $.sidr('close','main-menu');

        // If the selected page is 
        if (nextup !== "start" && nextup !== "login" && nextup !== "updates"){
            $('.interactive-status').fadeIn('fast');
        } else {
            $('.interactive-status').fadeOut('fast');
        }

        return false; 
    } );
}
pageNavigation();

// Launches tooltip
// This initializes all tooltips
$(document).ready(function() {
    $('.tooltip').tooltipster({
        delay: 100,
        maxWidth: 500,
        speed: 300,
        interactive: true,
        animation: 'grow',
        maxWidth: 200,
        theme : 'tooltipster-punk',
        side: "left"
    });
});

// Open Link In Browser
// This opens link in system default browser.
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    shell.openExternal(this.href);
});