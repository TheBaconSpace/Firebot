const JsonDB = require('node-json-db');

// Tactile
function tactileProgress(tactile) {

    // If tactile doesnt exist then stop here.
    if(!tactile || !tactile.length) return [];

    // List to build on while parsing the entire tactile report.
    var tempList = []

    // Get user settings
    var dbSettings = new JsonDB('./user-settings/settings', true, false);
    var activeProfile = dbSettings.getData('/interactive/activeBoard');
    var dbControls = new JsonDB('./user-settings/controls/' + activeProfile, true, false);
    var controls = dbControls.getData('/');

    // Loop through the tactile list.
    for (i = 0; i < tactile.length; i++) {
        var rawid = tactile[i].id;
        var holding = tactile[i].holding;
        var press = tactile[i].pressFrequency;

        // This button was pushed.
        if ( press > 0 || holding > 0){
            // So, get the user specific settings for it.
            var button = controls.tactile[rawid];
            var cooldown = convertTime(button);
            var cooldownArray = parseBuddies(button);

            // If we have a cooldown buttons list...
            if (cooldownArray !== false && cooldownArray.length > 1){
                // Start looking at each of them.
                for (i = 0; i < cooldownArray.length; i++) {
                    // See if they already have an entry in the temp list.
                    var id = cooldownArray[i];
                    var tempEntry = tempList[id];

                    // This looks to see if there is a temp entry already.
                    // If there is then this makes sure the correct values get overwritten.
                    if(tempEntry !== undefined && tempEntry !== null){
                        // An entry already exists, compare cooldowns and take the larger of the two.
                        var savedCooldown = tempEntry['cooldown'];
                        if (savedCooldown > cooldown){
                            var cooldown = savedCooldown;
                        }
                    }

                    if (rawid === id){
                        // This button is the one we're currently analyzing in the report.
                        // So, we want to send over fired true because someone is pressing it.
                        console.log(id, 'Pressed Button')
                        tempList[id] = {
                            "id": id,
                            "cooldown": cooldown,
                            "fired": true,
                            "progress": 1
                        };
                    } else if (tempEntry === undefined){
                        // This button is not in the temp list at all and isnt the one being pressed.
                        // Send the cooldown forward but not fired true or progress 1.')
                        console.log(id, 'Not pressed Not in list')
                        tempList[id] = {
                            "id": id,
                            "cooldown": cooldown,
                            "fired": false,
                            "progress": 0
                        };
                    } else {
                        // This button already has an entry in the temp list.
                        // So, we want to keep everything the same, except go with the bigger cooldown.
                        console.log(id, 'Not pressed, but in list.') 
                        tempList[id] = {
                            "id": id,
                            "cooldown": cooldown,
                            "fired": tempEntry['fired'],
                            "progress": tempEntry['progress']
                        };
                    }
                }
            } else {
                // Get temp list entry for this id
                var tempEntry = tempList[rawid];

                // This looks to see if there is a temp entry already.
                // If there is then this makes sure the correct values get overwritten.
                if(tempEntry !== undefined && tempEntry !== null){
                    // An entry already exists, compare cooldowns and take the larger of the two.
                    var savedCooldown = tempEntry['cooldown'];
                    if (savedCooldown > cooldown){
                        var cooldown = savedCooldown;
                    }
                }

                // Grab first thing in array.
                var id = cooldownArray[0];

                if (tempEntry === undefined){
                    // This button is not in the temp list at all.
                    console.log(id, 'Solo pressed, not in list.')
                    tempList[id] = {
                        "id": id,
                        "cooldown": cooldown,
                        "fired": true,
                        "progress": 1
                    };
                } else {
                    // This button already has an entry in the temp list.
                    // So, we want to keep everything the same, except go with the bigger cooldown.
                    console.log(id, 'Solo pressed, in list.') 
                    tempList[id] = {
                        "id": id,
                        "cooldown": cooldown,
                        "fired": true,
                        "progress": 1
                    };
                }
            }
        } else {
            // This button wasn't pushed this time around.
            // Need to send over fired = false to reset the animation and progress = 0.
            tempList[rawid] = {
                "id": rawid,
                "fired": false,
                "progress": 0
            };
        }
    }

    // Here we loop through the temp list and piece together the final report.
    // Create a new function to do this and just have it return json.
    var finalReport = finalizeReport(tempList);

    //if(finalReport.some(item => item.cooldown > 0)) console.log(finalReport);
    return finalReport;
}

// Finalize Report 
// This loops through the temp list and builds the final json to send back to the progress processor
function finalizeReport(tempList){
    var finalList = [];
    var tempList = tempList.filter(entry => /\S/.test(entry));
    for (i = 0; i < tempList.length; i++) {
        var listItem = tempList[i];

        // Piece together the entry for this button.
        if (listItem.cooldown === undefined ){
            finalList.push({"id": listItem.id, "fired": listItem.fired, "progress": listItem.progress});
        } else {
            finalList.push({"id": listItem.id, "cooldown": listItem.cooldown, "fired": listItem.fired, "progress": listItem.progress});
        }
        
    }
    return finalList;
}

// Parse Cooldown Buddies
// This takes the cooldown buddy list and returns a clean array.
function parseBuddies(button){
    var cooldownButtons = button['cooldownButtons'];
    if (cooldownButtons !== undefined && cooldownButtons !== null && cooldownButtons !== ""){
        // Take cooldown list for this button and turn it into an array.
        var cooldownArray = cooldownButtons.replace(/ /g,'').split(',');
        // Then remove empty values from the array.
        var cooldownArray = cooldownArray.filter(entry => /\S/.test(entry));
        // Turn each into numbers.
        for(var i = 0; i < cooldownArray.length; i++) {
            cooldownArray[i] = parseInt(cooldownArray[i]);
        }
        return cooldownArray;
    } else {
        return false;
    }
}

// Convert to Milliseconds
// This takes a number in seconds and converts it to Milliseconds
function convertTime(button){
    if (button['cooldown'] !== ""){
        var newTime = parseInt( button['cooldown'] ) * 1000;
        return newTime;
    } else {
        return 0;
    }
}



// Module Exports
exports.update = tactileProgress;