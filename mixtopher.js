const BeamClient = require('beam-client-node');
const BeamSocket = require('beam-client-node/lib/ws');
const beam = new BeamClient();
const Interactive = require('beam-interactive-node');
const Packets = require('beam-interactive-node/dist/robot/packets').default;
const WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({
        port: 8080
    });
const JsonDB = require('node-json-db');
const say = require('say');
const request = require('request');
const parseString = require('xml2js').parseString;
const validator = require('validator');
const randomPuppy = require('random-puppy');

var dbAuth = new JsonDB("./settings/auth", true, false);
var dbControls = new JsonDB('./controls/controls', true, false);
var dbClickerBoss = new JsonDB('./settings/clickerBoss', true, false);


// Global Vars
// Use this link to get your oauth token and put it in auth.json.
// https://beam.pro/oauth/authorize?response_type=token&redirect_uri=http:%2F%2Flocalhost&scope=interactive:robot:self%20interactive:manage:self%20user:details:self%20chat:whisper%20chat:connect%20chat:chat&client_id=f78304ba46861ddc7a8c1fb3706e997c3945ef275d7618a9
app = {
	auth: dbAuth.getData('/'),
	controls: dbControls.getData('/'),
	clickerBoss: dbClickerBoss.getData('/'),
	clientID: "f78304ba46861ddc7a8c1fb3706e997c3945ef275d7618a9",
	progress: ""
}

//////////////
// Helpers
/////////////

// Capitalize Name
function toTitleCase(str){
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}


// Connects to interactive
function beamConnect() {

    const channelId = app.auth['channelID'];
    const authToken = app.auth['token'];

    beam.use('oauth', {
        clientId: app.clientID,
        tokens: {
            access: authToken,
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000
        }
    })
    beam.game.join(channelId)
        .then(res => createRobot(res, channelId))
        .then(robot => performRobotHandShake(robot))
        .then(robot => setupRobotEvents(robot))
        .catch(err => {
            if (err.res) {
                throw new Error('Error connecting to Interactive:' + err.res.body.message);
            }
            throw err;
        });
};

// Creating Robot
function createRobot(res, channelId) {
    console.log('Creating robot...')
    return new Interactive.Robot({
        remote: res.body.address,
        channel: channelId,
        key: res.body.key,
    });
}

// Robot Handshake
function performRobotHandShake(robot) {
    console.log('Robot Handshaking...');
    return new Promise((resolve, reject) => {
        robot.handshake(err => {
            if (err) {
                reject(err);
            }
            resolve(robot);
        });
    });
}

// Robot Events
function setupRobotEvents(robot) {
    console.log("Good news everyone! Interactive is ready to go!");
    robot.on('report', report => {

        if (report.tactile.length > 0) {
            tactile(report.tactile);
            tactileProgress(report.tactile);
        }
        if (report.joystick.length > 0) {
            joystick(report.joystick[0]);
            joystickProgress(report.joystick[0]);
        }
        if (report.screen.length > 0) {
            screen(report.screen[0]);
            screenProgress(report.screen[0]);
        }

        progressUpdate(robot);
    });
    robot.on('error', err => {
        console.log('Error setting up robot events.', err);
    });

    robot = robot;
}

// Websocket Server
// This allows for the guiBroadcast call to send out data via websocket.
guiBroadcast = function broadcast(data) {
    wss.clients.forEach(function each(client) {
        client.send(data);
    });
};
// This allows the websocket server to accept incoming packets from overlay.
wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        var message = JSON.parse(message);
        var eventType = message.event;
        if (eventType == "bossFightEnd") {
            bossFightEnd(message.data);
        }
    });
});

////////////////////
// Handlers
////////////////////

// Tactile Handler
function tactile(tactile) {

    for (i = 0; i < tactile.length; i++) {
        // Get Button Settings for ID
        var rawid = tactile[i].id;
        var holding = tactile[i].holding;
        var press = tactile[i].pressFrequency;
        var button = app.controls.tactile[rawid];

        // DO SOME STUFF WITH THE BUTTONS
        if (button !== undefined && button !== null) {
            if (isNaN(press) === false && press > 0) {
                tactilePress(rawid);
            };
        } else {
            console.log("Button " + rawid + " doesn't exist in controls file!");
        }
    }
}

// Joystick Controls
function joystick(report) {
    // DO SOMETHING WITH JOYSTICK REPORT.
}

// Screen Controls
function screen(report) {
    // DO SOMETHING WITH SCREEN REPORT.
    var mean = report.coordMean;
    var horizontal = 1920 * mean.x;
    var vertical = 1080 * mean.y;
    var clicks = report.clicks;
    if (isNaN(horizontal) === false && isNaN(vertical) === false) {
        guiBroadcast('{ "event": "mouseclick", "mousex": ' + horizontal + ', "mousey": ' + vertical + ', "clicks": ' + clicks + '}');
    }
}

////////////////////
// Progress Updates
////////////////////

// Progress Compile
function progressUpdate(robot) {
    var tactile = app.tactileProgress;
    var screen = app.screenProgress;
    var joystick = app.joystickProgress;
    var lastProgress = app.lastProgress

    // Compile report.
    var progress = {
        "tactile": tactile,
        "screen": screen,
        "joystick": joystick
    }

    // Send progress update if it has any new info.
	if( isEmpty(tactile) === false || isEmpty(screen) === false || isEmpty(joystick) === false ){
		robot.send(new Packets.ProgressUpdate(progress));
	}

    // Save progress update for comparison next round.
    app.lastProgress = progress;
    
    // Clear temp progress reports.
    app.tactileProgress = [];
    app.screenProgress = [];
    app.joystickProgress = [];
}

// Tactile
function tactileProgress(tactile) {
    var json = [];

    // Events fired this report.
    var soundboardFired = false;
    var funFired = false;

    // Loop through report.
    for (i = 0; i < tactile.length; i++) {
        var rawid = tactile[i].id;
        var holding = tactile[i].holding;
        var press = tactile[i].pressFrequency;

        var controls = app.controls;
        var button = controls.tactile[rawid];
        var cooldown = button['cooldown'];
        var event = button['event'];

        // Convert JSON Cooldown Number to Milliseconds
        var cooldown = parseInt(cooldown) * 1000;

        if (isNaN(holding) === false && holding > 0 || isNaN(press) === false && press > 0) {
			
			if(event == "attack" && funFired === false){
				// Soundboard hit!
				// Cooldown 1-4
				i = 1;
				while (i < 5){
					json.push({
						"id": i,
						"cooldown": cooldown,
						"fired": true,
						"progress": 1
					});
					i++;
				}
			} else if ( event == "soundboard" && soundboardFired === false){
				// Attack hit!
				// Cooldown 6-21
				i = 6;
				while (i < 22){
					json.push({
						"id": i,
						"cooldown": cooldown,
						"fired": true,
						"progress": 1
					});
					i++;
				}
			} else {
				json.push({
					"id": rawid,
					"cooldown": cooldown,
					"fired": true,
					"progress": 1
				});
			}
			
        };
    }
    app.tactileProgress = json;
}

// Screen
function screenProgress(screen) {

    var json = [];
    var rawid = screen.id;
    var mean = screen.coordMean;
    var screenX = mean.x;
    var screenY = mean.y;
    var clicks = screen.clicks;

    if (clicks > 0) {
        json.push({
            "id": rawid,
            "clicks": [{
                "coordinate": mean,
                "intensity": 1
            }]
        });
    }
    app.screenProgress = json;
}

// Joystick
function joystickProgress(joystick) {
    var json = [];
    var rawid = joystick.id;
    var mean = joystick.coordMean;
    var joyX = mean.x;
    var joyY = mean.y;
    if (isNaN(joyX) === true) {
        var joyX = 0;
    }
    if (isNaN(joyY) === true) {
        var joyY = 0;
    }

    var rad = Math.atan2(joyY, joyX);

    json.push({
        "id": rawid,
        "angle": rad,
        "intensity": 1
    });
    app.joystickProgress = json;
}

////////////////////
// Functionality
////////////////////

// Handle Button Taps
function tactilePress(rawid) {
    var controls = app.controls;
    var button = controls.tactile[rawid];
    var buttonEvent = button.event;

    if (buttonEvent == "soundboard") {
        // Soundboard
        console.log('Someone pressed soundboard key #' + rawid + '.');
        guiBroadcast('{ "event": "soundboard", "id": "' + rawid + '"}');
    }

    if (buttonEvent == "attack"){
        // Character Attacked
		var target = button.target;
        console.log('Someone pressed attack key #' + rawid + '. Target: '+target+'.');
        guiBroadcast('{ "event": "attack", "id": "' + rawid + '", "target": "'+target+'"}');
    }
	
	if (buttonEvent == "poison"){
        // Character Attacked
		var target = button.target;
        console.log('Someone pressed poison key #' + rawid + '. Target: '+target+'.');
        guiBroadcast('{ "event": "attack", "id": "' + rawid + '", "target": "'+target+'"}');
    }

}

/////////////////////////
// Interactive Games
/////////////////////////

// Check if object empty.
function isEmpty(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }

    return true;
}

beamConnect();