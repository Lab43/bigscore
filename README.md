## To Do

* It's weird that game is first defined as null, then assigned a model instance after the socket room is joined. If the room is never joined calls to game methods will cause an error.
* Need to address non-integer values in scores
* Pass redis url to client as a config variable, so that it can be changed for development/production