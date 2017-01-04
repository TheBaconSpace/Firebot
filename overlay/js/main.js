// General Settings
var openTime = 8000;
timesClicked = 0;
paintingStatus = false;

// CHAT
// Connect to Beam Websocket
function beamSocketConnect(){
	if ("WebSocket" in window){
		// Let us open a web socket
		ws = new ReconnectingWebSocket("ws://localhost:8080");
		ws.onopen = function(){
			console.log("Connection is opened...");
		};

		ws.onmessage = function (evt){
			var obj = JSON.parse(evt.data);
			var event = obj.event;
			
			if (event == "attack"){
				attack(obj);
			}
			
			if (event == "soundboard"){
				// Play a sound!
				soundboard(obj);
			}
		};

		ws.onclose = function(){
		  // websocket is closed.
		  console.log("Connection is closed...");
		};

	} else {
		// The browser doesn't support WebSocket
		console.error("Woah, something broke. Abandon ship!");
	}
}
beamSocketConnect();


////////////////////////
// Soundboard
///////////////////////
function soundboard(obj){
    var soundId = obj.id;
	$('.soundboard'+soundId).trigger("play");
}

////////////////////////
// Effects
///////////////////////
function attack(obj){
	var target = obj.target;
	console.log('Playing: .'+target+'-attack')

	$('.'+target+'-attack').trigger("play");
	
	var image = "./images/"+target+".gif"+"?a="+Math.random();
	$('.wrapper').append('<div class="attack" style="display:none"><img src="'+image+'" width="800" height="600"></div>');
	$('.attack').fadeIn('fast');
	setTimeout(function(){ 
		$('.attack').fadeOut('fast');
		$('.attack').remove();
	}, 10000);
}



// Error Handling & Keep Alive
function errorHandle(ws){
  var wsState = ws.readyState;
  if (wsState !== 1){
    // Connection not open.
    console.log('Ready State is '+wsState);
  } else {
    // Connection open, send keep alive.
    ws.send(2);
  }
}