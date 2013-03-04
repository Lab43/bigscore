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
  .use(express.static(__dirname + '/public'))
;




// ======
// routes
// ======

app.get('/', function (req, res) {
  res.render('index');
});
app.get('/:gid', function (req, res) {
  res.render('game', {
    gid: req.params.gid,
  });
});




// =============
// socket.io api
// =============

io.sockets.on('connection', function (socket) {

  var game = null;

  socket
    .on('join', function (data) {
      socket.join(data.gid);
      game = new Game(data.gid);
      socket.emit('joined', {gid: game.id});
      game.broadcastUpdate();
    })
    .on('add player', function (data) {
      game.addPlayer();
    })
    .on('delete player', function (data) {
      game.deletePlayer(data.i);
    })
    .on('update name', function (data) {
      game.updateName(data.i, data.n);
    })
    .on('update score', function (data) {
      game.updateScore(data.i, data.s);
    })
  ;
});




// ==========
// game model
// ==========

function Game(gid) {

  this.id = gid;

  var self = this
    , key = 'games:' + gid
    , namesKey = key + ':names'
    , scoresKey = key + ':scores'
  ;

  this.broadcastUpdate = function () {
    async.parallel([
      function (callback) {
        store.lrange(namesKey, 0, -1, function (err, res) {
          callback(err, res);
        });
      },
      function (callback) {
        store.lrange(scoresKey, 0, -1, function (err, res) {
          callback(err, res);
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

}




// ======
// server
// ======

server.listen(3000, function(){
  console.log('Express server listening on port 3000');
});