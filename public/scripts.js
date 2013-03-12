// =========
// game data
// =========

function Game(socket, gid, pass, page) {

  var names = []
    , scores = []
    , self = this
  ;

  socket
    .on('connect', function () {
      socket.emit('join', {gid: gid, pass: pass});
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
    page.delayedSort();
    socket.emit('update score', {i: index, s: score});
  };

  this.incrScore = function (index) {
    scores[index]++;
    page.updateScore(index, scores[index]);
    self.updateScore(index, scores[index]);
  };

  this.decrScore = function (index) {
    scores[index]--;
    page.updateScore(index, scores[index]);
    self.updateScore(index, scores[index]);
  };

  // private methods
  function handleUpdate(data) {
    var oldNames = names.slice(0)
      , oldScores = scores.slice(0)
      , sortChange = false
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
        if (oldNames[j] !== names[j]) {
          page.updateName(j, names[j]);
        }
        if (oldScores[j] !== scores[j]) {
          page.updateScore(j, scores[j]);
          sortChange = true;
        }
      }
    }
    // if there were score changes, sort immediately
    if (sortChange) page.sort();
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
    // sort players and insert into page
    $('#players').empty().append( $(html).sortPlayers() );
    self.count();
  };

  this.updateName = function (index, name) {
    playerAtIndex(index).find('.name span').html(name);
  };

  this.updateScore = function (index, score) {
    playerAtIndex(index).find('.score span').html(score);
  };

  this.delayedSort = function () {
    clearTimeout(sortDelay);
    sortDelay = setTimeout(function () {
      self.sort();
    }, 1500);
  };

  this.sort = function () {
    clearTimeout(sortDelay);
    $('.player').sortPlayers();
  };

  this.count = function () {
    var count = $('.player').length;
    $('#players').attr('data-count', count);
  };

  // private methods
  function playerAtIndex(index) {
    return $('.player[data-index="'+index+'"]');
  }
  function renderPlayer(p) {
    return [
      '<div class="player" data-index="'+p.index+'">',
        '<div class="name"><span contenteditable="true">'+p.name+'</span></div>',
        //'<input class="name" value="'+p.name+'" placeholder="Name">',
        '<div class="score"><span contenteditable="true">'+p.score+'</span></div>',
        //'<input class="score" value="'+p.score+'" placeholder="0">',
        '<div class="incr-decr-wrapper">',
          '<button class="decr">-</button>',
          '<button class="incr">+</button>',
        '</div>',
        '<div class="delete-player-wrapper">',
          '<button class="delete-player">delete</button>',
        '</div>',
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
    , game = new Game(socket, config.gid, config.pass, page)
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
    .on('keyup', '.name span', function (e) {
      game.updateName(playerIndexOf(this), $(this).html());
    })
    .on('keyup', '.score span', function (e) {
      game.updateScore(playerIndexOf(this), parseInt($(this).html(), 10));
    })
  ;

})(jQuery);

// helper functions
function playerIndexOf(elem) {
  if (!(elem instanceof jQuery)) elem = jQuery(elem);
  var player = elem.hasClass('.player') ? elem : elem.closest('.player');
  return parseInt(player.attr('data-index'), 10);
}




// ==============
// jquery plugins
// ==============

(function ($){

  $.fn.sortPlayers = function() {

    var sortMe = []
      , $players = this
    ;

    $players.each(function (i) {
      sortMe.push({
        prevPlace: parseInt($(this).attr('data-place'), 10) || 0,
        index: i,
        score: parseInt($(this).find('.score span').html(), 10),
      });
    });
    sortMe.sort(function (a, b) {
      // if there's a tie, preserve previous order
      if (b.score === a.score) return a.prevPlace - b.prevPlace;
      return b.score - a.score;
    });
    $.each(sortMe, function (place, player) {
      // places start at 1, not 0
      place++;
      var direction = (place < player.prevPlace) ? 'up' : 'down';
      $($players.get(player.index))
        .attr('data-place', place)
        .attr('data-moved', direction)
      ;
    });

    return $players;

  };

})(jQuery);