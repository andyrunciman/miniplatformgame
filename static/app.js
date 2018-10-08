//Module pattern
(function() {
  //-----------------------------------------------------------------
  // Utilities
  //-----------------------------------------------------------------

  const loadJSON = function(url) {
    return new Promise((resolve, reject) => {
      if (!url) return reject('Invalid URL');
      let request = new XMLHttpRequest();
      request.onreadystatechange = () => {
        if (request.readyState === 4 && request.status === 200) {
          resolve(JSON.parse(request.responseText));
        }
      };
      request.open('GET', url, true);
      request.send();
    });
  };

  function timestamp() {
    return window.performance && window.performance.now
      ? window.performance.now()
      : new Date().getTime();
  }

  const limit = function(x, min, max) {
    return Math.max(min, Math.min(max, x));
  };

  var t2p = function(t) {
    return t * TILE;
  };

  var p2t = function(p) {
    return Math.floor(p / TILE);
  };

  const tcell = function(tx, ty) {
    return map[tx + ty * MAP.tw];
  };

  const cell = function(x, y) {
    return tcell(p2t(x), p2t(y));
  };

  const overlap = function(entity1, entity2) {
    return (
      ((entity2.x >= entity1.x && entity2.x <= entity1.x + TILE) ||
        (entity2.x + TILE >= entity1.x && entity2.x <= entity1.x)) &&
      ((entity2.y >= entity1.y && entity2.y <= entity1.y + TILE) ||
        (entity2.y + TILE >= entity1.y && entity2.y <= entity1.y))
    );
  };
  //take a look at a better version of this

  //-----------------------------------------------------------------
  // Constants
  //-----------------------------------------------------------------

  const MAP = { tw: 64, th: 48 }, // the size of the map (in tiles)
    TILE = 32, // the size of each tile (in game pixels)
    METER = TILE; // abitrary choice for 1m
  //GRAVITY = METER * 9.8 * 6; // very exagerated gravity (6x)
  //MAXDX = METER * 20, // max horizontal speed (20 tiles per second)
  //MAXDY = METER * 60, // max vertical speed   (60 tiles per second)
  //ACCEL = MAXDX * 2, // horizontal acceleration -  take 1/2 second to reach maxdx
  //FRICTION = MAXDX * 6, // horizontal friction     -  take 1/6 second to stop from maxdx
  //JUMP = METER * 1500; // (a large) instantaneous jump impulse

  const COLOR = {
    BLACK: '#000000',
    YELLOW: '#ECD078',
    BRICK: '#D95B43',
    PINK: '#C02942',
    PURPLE: '#542437',
    GREY: '#333',
    SLATE: '#53777A'
  };

  const COLORS = [
    COLOR.BLACK,
    COLOR.YELLOW,
    COLOR.BRICK,
    COLOR.PINK,
    COLOR.PURPLE,
    COLOR.GREY
  ];

  var now,
    dt = 0,
    last = timestamp(),
    slow = 1,
    step = 1 / 60,
    slowStep = step * slow,
    canvas = document.getElementById('canvas'),
    ctx = canvas.getContext('2d'),
    width = (canvas.width = MAP.tw * TILE),
    height = (canvas.height = MAP.th * TILE),
    map = [],
    monsters = [],
    treasure = [],
    player = {};

  //-------------------------------------------------------------------------
  // THE GAME LOOP
  //-------------------------------------------------------------------------

  const frame = function() {
    now = timestamp();
    dt = dt + Math.min(1, (now - last) / 1000);
    while (dt > slowStep) {
      //skips slow step until dt catches up
      dt = dt - slowStep;
      update(1 / 60);
    }
    render(dt / slow);
    last = now;
    requestAnimationFrame(frame);
  };

  //-------------------------------------------------------------------------
  // Updating
  //-------------------------------------------------------------------------

  var KEY = {
    LEFT: 37,
    RIGHT: 39,
    SPACE: 32
  };

  document.addEventListener(
    'keydown',
    event => {
      onKey(event, event.keyCode, true);
    },
    false
  );

  document.addEventListener(
    'keyup',
    event => {
      onKey(event, event.keyCode, false);
    },
    false
  );

  function onKey(ev, key, pressed) {
    switch (key) {
      case KEY.LEFT:
        player.left = pressed;
        ev.preventDefault(); //stop the screen scrolling!
        break;
      case KEY.RIGHT:
        player.right = pressed;
        ev.preventDefault(); //stop the screen scrolling!
        break;
      case KEY.SPACE:
        player.jump = pressed;
    }
  }

  const update = function(dt) {
    updatePlayer(dt);
    updateMonsters(dt);
    checkTreasure();
  };

  const updatePlayer = function(dt) {
    updateEntity(dt, player);
  };

  const checkTreasure = function() {
    treasure.forEach(item => {
      if (overlap(player, item)) {
        item.collected = true;
      }
    });
  };

  const updateMonsters = function(dt) {
    monsters.forEach(monster => {
      updateMonster(dt, monster);
    });
  };

  const updateMonster = function(dt, monster) {
    if (!monster.dead) {
      updateEntity(dt, monster);
      if (overlap(player, monster)) {
        //here, if we are falling and we are more than half a tile above the monster we can kill it
        if (player.dy > 0 && monster.y - player.y > TILE / 2) {
          killMonster(monster);
        } else {
          killPlayer(player);
        }
      }
    }
  };

  const killMonster = function(monster) {
    monster.dead = true;
  };

  const killPlayer = function(player) {
    player.x = 100;
    player.y = 100;
    console.log('player killed');
  };

  const updateEntity = function(dt, entity) {
    entity.y = Math.floor(entity.y + dt * entity.dy);
    entity.x = Math.floor(entity.x + dt * entity.dx);

    var wasleft = entity.dx < 0;
    var wasright = entity.dx > 0;

    entity.ddx = 0;
    entity.ddy = entity.GRAVITY;
    //entity.ddy = 0;

    if (entity.left) entity.ddx = entity.ddx - entity.ACCEL;
    // entity wants to go left
    else if (wasleft) entity.ddx = entity.ddx + entity.FRICTION; // entity was going left, but not any more

    if (entity.right) entity.ddx = entity.ddx + entity.ACCEL;
    // entity wants to go right
    else if (wasright) entity.ddx = entity.ddx - entity.FRICTION; // entity was going right, but not any more

    if (entity.jump && !entity.jumping && !entity.falling) {
      entity.ddy = entity.ddy - entity.JUMP; // apply an instantaneous (large) vertical impulse
      entity.jumping = true;
    }

    //we update the entity with the previous vector?? Why not the other way around??

    //calculate the next vector
    entity.dx = limit(entity.dx + dt * entity.ddx, -entity.MAXDX, entity.MAXDX); //we only need 1/60 of the amount of ddx for the frame 60FPS
    entity.dy = limit(entity.dy + dt * entity.ddy, -entity.MAXDY, entity.MAXDY);

    //is this in the correct place?
    if ((wasleft && entity.dx > 0) || (wasright && entity.dx < 0)) {
      entity.dx = 0; // clamp at zero to prevent friction from making us jiggle side to side
    }

    //collision detection

    var tx = p2t(entity.x),
      ty = p2t(entity.y),
      nx = entity.x % TILE, // true if entity overlaps right
      ny = entity.y % TILE, // true if entity overlaps below
      cell = tcell(tx, ty),
      cellright = tcell(tx + 1, ty), //can this return undefined??
      celldown = tcell(tx, ty + 1),
      celldiag = tcell(tx + 1, ty + 1);

    //this works as cells with 0 or undefined evaluate to zero.
    if (entity.dy > 0) {
      if ((celldown && !cell) || (celldiag && !cellright && nx)) {
        entity.y = t2p(ty); // clamp the y position to avoid falling into platform below
        entity.dy = 0; // stop downward velocity
        entity.falling = false; // no longer falling
        entity.jumping = false; // (or jumping)
        ny = 0; // - no longer overlaps the cells below
      }
    } else if (entity.dy < 0) {
      if ((cell && !celldown) || (cellright && !celldiag && nx)) {
        entity.y = t2p(ty + 1); // clamp the y position to avoid jumping into platform above
        entity.dy = 0; // stop upward velocity
        cell = celldown; // entity is no longer really in that cell, we clamped them to the cell below
        cellright = celldiag; // (ditto)
        ny = 0; // entity no longer overlaps the cells below
      }
    }

    if (entity.dx > 0) {
      if ((cellright && !cell) || (celldiag && !celldown && ny)) {
        entity.x = t2p(tx); // clamp the x position to avoid moving into the platform we just hit
        entity.dx = 0; // stop horizontal velocity
        nx = 0;
      }
    } else if (entity.dx < 0) {
      if ((cell && !cellright) || (celldown && !celldiag && ny)) {
        entity.x = t2p(tx + 1); // clamp the x position to avoid moving into the platform we just hit
        entity.dx = 0; // stop horizontal velocity
        nx = 0;
      }
    }
    if (entity.monster) {
      if (entity.left && (cell || !celldown)) {
        entity.right = true;
        entity.left = false;
        entity.dx = 0;
      }
      if (entity.right && (cellright || !celldiag)) {
        entity.left = true;
        entity.right = false;
        entity.dx = 0;
      }
    }

    entity.falling = !(celldown || (nx && celldiag)); //falling if there is nether are true
  };

  //-------------------------------------------------------------------------
  // RENDERING
  //-------------------------------------------------------------------------

  const render = function(dt) {
    //console.log(width, height);
    ctx.clearRect(0, 0, width, height);
    for (var h = 0; h < MAP.th; h++) {
      for (var w = 0; w < MAP.tw; w++) {
        ctx.fillStyle = COLORS[tcell(w, h)];
        ctx.fillRect(w * TILE, h * TILE, TILE, TILE);
      }
    }
    renderPlayer();
    renderMonsters();
    renderTreasure();
  };

  const renderPlayer = function() {
    ctx.fillStyle = COLOR.PINK;
    ctx.fillRect(player.x, player.y, TILE, TILE);
  };

  const renderMonsters = function() {
    monsters.forEach(monster => {
      if (!monster.dead) {
        ctx.fillStyle = COLOR.PURPLE;
        ctx.fillRect(monster.x, monster.y, TILE, TILE);
      }
    });
  };

  const renderTreasure = function() {
    treasure.forEach(item => {
      if (!item.collected) {
        ctx.fillStyle = COLOR.YELLOW;
        ctx.fillRect(item.x, item.y, TILE, TILE);
      }
    });
  };

  //-------------------------------------------------------------------------
  // Setup
  //-------------------------------------------------------------------------

  const setup = function(data) {
    map = data.layers[0].data;
    const objects = data.layers[1].objects;
    //loop throught and add each entity
    objects.forEach(obj => {
      switch (obj.type) {
        case 'treasure':
          treasure.push(setupEntity(obj));
          break;
        case 'monster':
          monsters.push(setupEntity(obj));
          break;
        case 'player':
          player = setupEntity(obj);

          break;
      }
    });
  };

  const setupEntity = function(data) {
    return {
      x: data.x || 100,
      y: data.y || 100,
      dx: 0,
      dy: 0,
      ddx: 0,
      ddy: 0,
      GRAVITY: METER * 9.8 * 6, // very exagerated gravity (6x)
      MAXDX: METER * 20, // max horizontal speed (20 tiles per second)
      MAXDY: METER * 60, // max vertical speed   (60 tiles per second)
      ACCEL: METER * 40, // horizontal acceleration -  take 1/2 second to reach maxdx
      FRICTION: METER * 60, // horizontal friction     -  take 1/6 second to stop from maxdx
      JUMP: METER * 1500, // (a large) instantaneous jump impulse
      type: data.type,
      left: data.properties.left || false,
      right: data.properties.right || false,
      jump: false,
      monster: data.type == 'monster',
      player: data.type == 'player',
      treasure: data.type == 'treasure',
      dead: false,
      falling: false
    };
  };

  loadJSON('./level.json').then(data => {
    map = data.layers[0].data;
    setup(data);
    frame();
  });
})();
