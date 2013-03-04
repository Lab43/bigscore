// =========
// game data
// =========

function Game(socket, gid, page) {

  var names = []
    , scores = []
    , self = this
  ;

  socket
    .on('connect', function () {
      socket.emit('join', {gid: gid});
    })
    .on('joined', function (data) {
      console.log('joined game ' + data.gid);
    })
    .on('update', function (data) {
      handleUpdate(data);
    })
  ;

  this.addPlayer = function () {
    socket.emit('add player');
  };

  this.deletePlayer = function (index) {
    socket.emit('delete player', {i: index});
  };

  this.updateName = function (index, name) {
    names[index] = name;
    socket.emit('update name', {i: index, n: name});
  };

  this.updateScore = function (index, score) {
    scores[index] = score;
    socket.emit('update score', {i: index, s: score});
  };

  this.incrScore = function (index) {
    scores[index]++;
    self.updateScore(index, scores[index]);
  };

  this.decrScore = function (index) {
    scores[index]--;
    self.updateScore(index, scores[index]);
  };

  // private methods
  function handleUpdate(data) {
    var oldNames = names.slice(0)
      , oldScores = scores.slice(0)
    ;
    names = data.n;
    scores = data.s;

    if (oldNames.length !== names.length) {
      var output = [];
      for (var i = 0; i < names.length; i++) {
        output.push({name: names[i], score: scores[i]});
      }
      page.updateAll(output);
    } else {
      for (var j = 0; j < names.length; j++) {
        if (oldNames[j] !== names[j])
          page.updateName(j, names[j]);
        if (oldScores[j] !== scores[j])
          page.updateScore(j, scores[j]);
      }
    }
  }

}




// ==============
// page rendering
// ==============

function Page($) {
  var self = this
    , sortDelay
  ;

  this.updateAll = function (data) {
    var html = '';
    $.each(data, function (i, val) {
      html += renderPlayer({index: i, name: this.name, score: this.score});
    });
    $('#players').html(html);
  };

  this.updateName = function (index, name) {
    playerAtIndex(index).find('.name').val(name);
  };

  this.updateScore = function (index, score) {
    playerAtIndex(index).find('.score').val(score);
  };

  // delayed sort would be called by game.updateScore, and other actions would shouldn't sort immediately because they would disrupt user interaction
  this.delayedSort = function () {
    clearTimeout(sortDelay);
    sortDelay = setTimeout(self.sort, 1000);
  };
  // sort is called by actions that should cause an immediate sort, such as update coming from the server
  this.sort = function (force) {
    // if force is true, cancel the sortDelay timeout and sort immediately
    // if force is false/undefined only sort immediately if there is no sortDelay, otherwise just wait for the delay to time out. This is useful if an update message is sent from the server while thie user is currently interacting with the app
    // sort code
  };

  // private methods
  function playerAtIndex(index) {
    return $('.player[data-index="'+index+'"]');
  }
  function renderPlayer(p) {
    return [
      '<div class="player" data-index="'+p.index+'">',
        '<input class="name" value="'+p.name+'" placeholder="Name">',
        '<input class="score" value="'+p.score+'" placeholder="0">',
        '<button class="decr">-</button>',
        '<button class="incr">+</button>',
        '<button class="delete-player">delete</button>',
      '</div>'
    ].join('');
  }

}




// ===
// app
// ===

(function($) {

  // set up app
  var socket = io.connect('http://localhost:3000')
    , page = new Page($)
    , game = new Game(socket, config.gid, page)
  ;

  // ui actions
  $(document)
    .on('click', '.add-player', function (e) {
      game.addPlayer();
    })
    .on('click', '.delete-player', function (e) {
      game.deletePlayer(playerIndexOf(this));
    })
    .on('click', '.incr', function (e) {
      game.incrScore(playerIndexOf(this));
    })
    .on('click', '.decr', function (e) {
      game.decrScore(playerIndexOf(this));
    })
    .on('keyup', '.name', function (e) {
      game.updateName(playerIndexOf(this), $(this).val());
    })
    .on('keyup', '.score', function (e) {
      game.updateScore(playerIndexOf(this), $(this).val());
    })
  ;

  // helper functions
  function playerIndexOf(elem) {
    if (!(elem instanceof $)) elem = $(elem);
    return parseInt(elem.closest('.player').attr('data-index'), 10);
  }

})(jQuery);