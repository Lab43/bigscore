## To Do

* Sever-side handling of authentication and game updates definitely needs work. It's a little hacked together, probably not secure, and possibly leaky. It smells bad too.
* Need to address non-integer values in scores
* Pass redis url to client as a config variable, so that it can be changed for development/production
* score increments and decrements are round-tripping to the server before being applied to the page.
* game.handleUpdate will call page.sort if it needs to update a score. If there is already a delayedSort timer running (for example, someone is simultaneously updating points in another browser), page.sort will interupt and apply sorting immediately. It would be better to check if a timer is running, then only apply sort if there is no timer.