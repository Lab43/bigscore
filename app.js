var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server)
  , redis = require('redis')
  , store = redis.createClient()
  , async = require('async')
;



// =============
// configure app
// =============

app
  .set('views', __dirname)
  .set('view engine', 'jade')
  .use(express.favicon())
  .use(express.logger('dev'))
  .use(express.static(__dirname + '/public'))
;




// ======
// routes
// ======

app.get('/', function (req, res, next) {
  res.render('index');
});
app.get('/new', function (req, res, next) {
  newGame(req, res, next);
});
app.get('/:code', function (req, res, next) {
  var params = req.params.code.split('-');
  res.locals.gid = params[0];
  res.locals.pass = params[1];
  if (params.length === 1) {
    spectator(req, res, next);
  } else if (params.length === 2) {
    scorekeeper(req, res, next);
  } else {
    res.send(404);
  }
});


function spectator(req, res, next) {
  var gid = res.locals.gid;
  // check if the game exists
  store.exists('games:' + gid + ':pass', function (err, exists) {
    if (!exists) return res.send(404);
    res.render('game', {
      gid: gid,
      pass: null
    });
  });
}

function scorekeeper(req, res, next) {
  var gid = res.locals.gid
    , pass = res.locals.pass
  ;
  // check that the game exists and pass is correct
  store.get('games:' + gid + ':pass', function (err, storedPass) {
    if (storedPass !== pass) return res.send(401);
    res.render('game', {
      gid: gid,
      pass: pass
    });
  });
}

function newGame(req, res, next) {
  async.waterfall([
    // get next game id and generate password
    function (callback) {
      store.incr('gid-counter', function(err, gid) {
        gid = gid.toString(36);
        // generate random 4 character alphanumeric string (0-9, a-z)
        var pass = Math.random().toString(36).substr(2, 4);
        callback(err, gid, pass);
      });
    },
    // save game id and password
    function (gid, pass, callback) {
      store.set('games:' + gid + ':pass', pass, function (err, val) {
        callback(err, {gid: gid, pass: pass});
      });
    }
  ], function (err, result) {
    if (err) return next(err);
    res.redirect('/' + result.gid + '-' + result.pass);
  });
}



// =============
// socket.io api
// =============

io.sockets.on('connection', function (socket) {
  socket.on('join', function (data) {
    socket.join(data.gid);
    joinGame(socket, data.gid, data.pass, function (err) {
      if (err) return console.log(err);
      socket.emit('joined', {gid: data.gid});
    });
  });
});




// ==========
// game model
// ==========

function joinGame(socket, gid, pass, callback) {

  this.id = gid;

  var self = this
    , key = 'games:' + gid
    , namesKey = key + ':names'
    , scoresKey = key + ':scores'
  ;

  // authorize
  if (pass) {
    store.get('games:' + gid + ':pass', function (err, storedPass) {
      if (err) return console.log(err);
      if (storedPass !== pass) return callback('Password "'+pass+'" incorrect.');
      self.registerApi();
    });
  }

  this.registerApi = function () {
    socket
      .on('add player', function (data) {
        self.addPlayer();
      })
      .on('delete player', function (data) {
        self.deletePlayer(data.i);
      })
      .on('update name', function (data) {
        self.updateName(data.i, data.n);
      })
      .on('update score', function (data) {
        self.updateScore(data.i, data.s);
      })
    ;
  };

  this.broadcastUpdate = function () {
    async.parallel([
      function (callback) {
        store.lrange(namesKey, 0, -1, function (err, result) {
          callback(err, result);
        });
      },
      function (callback) {
        store.lrange(scoresKey, 0, -1, function (err, result) {
          result = result.map(function (string) {
            return parseInt(string, 10);
          });
          callback(err, result);
        });
      }
    ],
    function (err, results) {
      if (err) return console.log(err);
      var data = {
        n: results[0],
        s: results[1]
      };
      io.sockets.in(self.id).emit('update', data);
    });
  };

  this.addPlayer = function () {
    store.rpush(namesKey, '');
    store.rpush(scoresKey, 0);
    self.broadcastUpdate();
  };

  this.deletePlayer = function (playerIndex) {
    async.parallel([

      // delete player's name
      function (callback) {
        async.series([
          // set name to __delete__
          function (callback) {
            store.lset(namesKey, playerIndex, '__delete__', function (err, res) {
              callback(err);
            });
          },
          // delete names equaling __delete__
          function (callback) {
            store.lrem(namesKey, 0, '__delete__', function (err, res) {
              callback(err);
            });
          }
        ], function (err, results) {
          callback(err);
        });
      },

      // delete player's score
      function (callback) {
        async.series([
          // set score to __delete__
          function (callback) {
            store.lset(scoresKey, playerIndex, '__delete__', function (err, res) {
              callback(err);
            });
          },
          // delete scores equaling __delete__
          function (callback) {
            store.lrem(scoresKey, 0, '__delete__', function (err, res) {
              callback(err);
            });
          }
        ], function (err, results) {
          callback(err);
        });
      }

    // done deleting player
    ], function (err, results) {
      if (err) return console.log(err);
      self.broadcastUpdate();
    });

  };

  this.updateName = function (playerIndex, newName) {
    store.lset(namesKey, playerIndex, newName, function (err, res) {
      if (err) return console.log(err);
      self.broadcastUpdate();
    });
  };

  this.updateScore = function (playerIndex, newScore) {
    store.lset(scoresKey, playerIndex, newScore, function (err, res) {
      if (err) return console.log(err);
      self.broadcastUpdate();
    });
  };

  callback(null);
  self.broadcastUpdate();

}




// ======
// server
// ======

server.listen(3000, function(){
  console.log('Express server listening on port 3000');
});