const express = require('express'); // <-- You need this!
const http = require('http');
const cors = require('cors');
const app = express();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: false
};

app.use(cors(corsOptions));

// Serve static files if needed (optional, for health check)
app.get('/', (req, res) => {
  res.send('Server is running!');
});

const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false // <--- set to false for testing
  }
});

const rooms = {};
const THEMES = [
  { name: 'Animal', items: ["dog","cat","cow","sheep","goat","horse","pig","chicken","duck","goose",
    "donkey","camel","deer","rabbit","mouse","rat","squirrel","bat",
    "monkey","gorilla","chimpanzee","panda","koala","kangaroo","bear","wolf",
    "fox","lion","tiger","cheetah","leopard","jaguar","zebra","giraffe",
    "hippo","rhino","elephant","crocodile","lizard","snake","frog",
    "turtle","crab","lobster","shrimp","octopus","squid",
    "starfish","dolphin","whale","shark","seal","penguin","eagle",
    "hawk","owl","parrot","flamingo","pigeon",
    ,"crow","bee","wasp","ant","butterfly",
    "moth","fly","mosquito","spider","scorpion","snail","bat","worm","spider",
    "cricket","hedgehog","coccinelle",
    "raccoon","armadillo","platypus"] },

    { name: 'Anime', items: ["naruto","sasuke","sakura","kakashi","jiraiya","itachi","madara","goku",
        "vegeta","gohan","trunks","piccolo","krillin","bulma","luffy","zoro",
        "sanji","nami","usopp","chopper","robin","shanks",
        "mihawk","tanjiro","nezuko","zenitsu","inosuke","kanao","giyu","shinobu",
        "muichiro","mitsuri","obito","rin","boruto","sarada","mitsuki","orochimaru",
        "hinata","kiba","shino","ino","choji","shikamaru","gaara","rock lee",
        "tenten","tsunade","minato","hashirama","tobirama","saitama",
        "tatsumaki","reigen","eren","mikasa","armin","levi","erwin","hange",
        "historia","annie","reiner","bertholdt","killua","gon","kurapika","hisoka",
        "yusuke","kurama",
        "light","L","ichigo","rukia","orihime","ulquiorra",
        "grimmjow","asta","yuno","yami","isagi","nagi","bachira","gojo","aiku","toji","yuji","kaiser","lorenzo"] },
  
        { name: 'Sports', items: ["football","basketball","tennis","volleyball","handball","baseball",
        "rugby","golf","cricket","badminton","ping pong",
        "hockey","skating","skiing",
        "surfing","swimming","diving","archery","fencing","boxing","karate",
        "wrestling","cycling","biking","skateboarding","bowling","darts",
        "billiards","horse racing",
        "fishing","gymnastics","dance","ballet",
        "marathon",
        "long jump",
        "bodybuilding","parkour","rock climbing",
        "hiking","paintball",
        "formula 1","karting","sumo",
       ,"esports"] },
  
        { name: 'Celebrity', items: ["cristiano ronaldo","lionel messi","neymar","kylian mbappe","karim benzema",
        "mohamed salah","kevin de bruyne","erling haaland","robert lewandowski",
        "luka modric","tony stark","chris hemsworth","chris evans","scarlett johansson",
        "tom holland","zendaya","emma watson","daniel radcliffe","rupert grint",
        "brad pitt","angelina jolie","johnny depp","will smith","jackie chan",
        "dwayne johnson","vin diesel","gal gadot","ryan reynolds","blake lively",
        "selena gomez","ariana grande","taylor swift","ed sheeran","shakira",
        "rihanna","beyonce","justin bieber","harry styles","zayn malik","niall horan",
        "liam payne","louis tomlinson","billie eilish","bruno mars","lady gaga",
        "dua lipa","nicki minaj","katy perry","miley cyrus","shawn mendes","drake",
        "post malone","the weeknd","snoop dogg","eminem","kanye west","jay z",
        "lebron james","stephen curry","michael jordan","kobe bryant","shaquille o'neal",
        "ronaldo nazario","pele","david beckham","zinedine zidane","andres iniesta",
        "xavi","ronaldinho","thierry henry","serena williams","roger federer",
        "rafael nadal","novak djokovic","usain bolt","michael phelps","simone biles",
        "ellen degeneres","oprah winfrey","jim carrey","steve carell","robert downey jr",
        "chris pratt","mark ruffalo","paul rudd","benedict cumberbatch","morgan freeman",
        "hugh jackman","ian mckellen","patrick stewart","tom hanks","keanu reeves",
        "adam sandler","seth rogen","ryan gosling","emma stone","jennifer lawrence"] },
  
        { name: 'Random Object', items: ["pen","pencil","book","notebook","bag","chair","table","desk","lamp","light",
        "bottle","glass","cup","plate","bowl","spoon","fork","knife","pan",
        "oven","microwave","fridge","phone","laptop","computer",
        "mouse","keyboard","charger","cable","earphones","headphones","tv","remote",
        "bed","pillow","blanket","sheet","mirror","window","door","wall","clock",
        "watch","wallet","key","keychain","umbrella","hat","cap","shoe","sock",
        "belt","scarf","glove","jacket","coat","shirt","tshirt","pants","jeans",
        "shorts","skirt","dress","ring","bracelet","toothbrush",
        "toothpaste","soap","shampoo","towel","comb","brush","razor","perfume",
        "deodorant","bag","box","basket","bin","broom","mop","vacuum","bucket",
        "ball","racket","net","rope","chain","string","tape","glue"] }
        ];

io.on('connection', (socket) => {
  socket.on('createRoom', ({ username }, callback) => {
    if (!username) {
      callback({ error: 'Username required' });
      return;
    }
    console.log('createRoom username:', username); // Add this line
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[roomCode] = { players: [{ name: username, ready: false, id: socket.id }], leader: socket.id, started: false };
    socket.join(roomCode);
    callback({ roomCode });
    io.to(roomCode).emit('updatePlayers', rooms[roomCode].players, rooms[roomCode].leader, rooms[roomCode].started);
    console.log('Emitting updatePlayers:', JSON.stringify(rooms[roomCode].players));
  });

  socket.on('joinRoom', ({ username, roomCode }, callback) => {
    if (!username) {
      callback({ error: 'Username required' });
      return;
    }
    if (!rooms[roomCode]) {
      callback({ error: 'Room not found' });
      return;
    }
    // Prevent duplicate players with the same socket.id
    if (!rooms[roomCode].players.find(p => p.id === socket.id)) {
      rooms[roomCode].players.push({ name: username, ready: false, id: socket.id });
    }
    socket.join(roomCode);
    callback({ success: true });
    io.to(roomCode).emit('updatePlayers', rooms[roomCode].players, rooms[roomCode].leader, rooms[roomCode].started);
    console.log('Emitting updatePlayers:', JSON.stringify(rooms[roomCode].players));
  });

  socket.on('setReady', ({ roomCode, ready }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) player.ready = ready;
    io.to(roomCode).emit('updatePlayers', room.players, room.leader, room.started);
  });

  socket.on('startGame', (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.leader !== socket.id) return;
    room.started = true;
    room.currentRound = 0;
    room.drawings = {};
    startNextRound(roomCode);
  });

  function startNextRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    let theme = null;
    let item = null;
    if (room.currentRound < THEMES.length) {
      theme = THEMES[room.currentRound].name;
      const items = THEMES[room.currentRound].items;
      item = items[Math.floor(Math.random() * items.length)];
    }
    const time = 120; // seconds
    const startTimestamp = Date.now();
    room.roundStartTimestamp = startTimestamp;
    room.roundTime = time;
    room.drawings = {}; // Reset drawings for the new round

    // --- TIMER ENFORCEMENT ---
    if (room.roundTimeout) clearTimeout(room.roundTimeout);
    room.roundTimeout = setTimeout(() => {
      // For any player who hasn't submitted, add a blank drawing
      for (const player of room.players) {
        if (!room.drawings[player.id]) {
          // You can use a blank image or a placeholder
          room.drawings[player.id] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAMAAACahl6sAAAAA1BMVEUAAACnej3aAAAASElEQVR4nO3BMQEAAAgDoJvc6F9hAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwG4wAAQ2r+JwAAAAASUVORK5CYII=";
        }
      }
      io.to(roomCode).emit('showDrawings', room.drawings);
    }, time * 1000);
    // --- END TIMER ENFORCEMENT ---

    io.to(roomCode).emit('startRound', {
      round: room.currentRound + 1,
      totalRounds: THEMES.length + 1,
      theme,
      item,
      time,
      startTimestamp
    });
  }

  socket.on('submitDrawing', ({ roomCode, round, drawing }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (!room.drawings) room.drawings = {};
    room.drawings[socket.id] = drawing;
    // When all drawings are in, move to rating
    if (Object.keys(room.drawings).length === room.players.length) {
      if (room.roundTimeout) clearTimeout(room.roundTimeout);
      io.to(roomCode).emit('showDrawings', room.drawings);
    }
  });

  // Provide player names for a room
  socket.on('getPlayerNames', ({ roomCode }, callback) => {
    const room = rooms[roomCode];
    if (!room) return callback([]);
    callback(room.players.map(p => ({ id: p.id, name: p.name })));
  });

  // Collect ratings
  socket.on('submitRating', ({ roomCode, targetId, rating }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (!room.ratings) room.ratings = {};
    if (!room.ratings[targetId]) room.ratings[targetId] = [];
    if (socket.id === targetId) return;
    // Remove previous rating from this user if exists
    room.ratings[targetId] = room.ratings[targetId].filter(r => r.from !== socket.id);
    // Clamp rating
    if (typeof rating !== 'number' || isNaN(rating)) rating = 0;
    if (rating < 0) rating = 0;
    if (rating > 10) rating = 10;
    room.ratings[targetId].push({ from: socket.id, value: rating });

    // Check if all ratings are in for all drawings
    const totalPlayers = room.players.length;
    let allRated = true;
    for (const pid of Object.keys(room.drawings)) {
      if (
        !room.ratings[pid] ||
        room.ratings[pid].length < totalPlayers - 1
      ) {
        allRated = false;
        break;
      }
    }
    if (allRated) {
      // Calculate scores
      const scores = {};
      for (const pid of Object.keys(room.drawings)) {
        const ratings = room.ratings[pid] || [];
        const avg = ratings.length
          ? (ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length)
          : 0;
        scores[pid] = { 
          average: Math.round(avg * 100) / 100, 
          ratings 
        };
      }
      io.to(roomCode).emit('showScores', { drawings: room.drawings, scores });
      room.waitingForNext = true;
      room.nextRoundReady = []; // <-- Add this line
    }
  });

  socket.on('unreadyDrawing', ({ roomCode, round }) => {
    const room = rooms[roomCode];
    if (!room || !room.drawings) return;
    // Remove the drawing for this player
    delete room.drawings[socket.id];
    // Also remove any ratings for this drawing (optional, for safety)
    if (room.ratings) {
      delete room.ratings[socket.id];
    }
  });

  // Handle next round readiness
  socket.on('nextRoundReady', ({ roomCode, ready }) => {
    const room = rooms[roomCode];
    if (!room || !room.waitingForNext) return;
    if (!room.nextRoundReady) room.nextRoundReady = [];
    if (ready) {
      if (!room.nextRoundReady.includes(socket.id)) room.nextRoundReady.push(socket.id);
    } else {
      room.nextRoundReady = room.nextRoundReady.filter(id => id !== socket.id);
    }
    io.to(roomCode).emit('nextRoundReadyUpdate', {
      ready: room.nextRoundReady.length,
      total: room.players.length
    });
    if (room.nextRoundReady.length === room.players.length) {
      room.waitingForNext = false;
      room.currentRound++;
      if (room.currentRound < THEMES.length + 1) {
        room.drawings = {};
        room.ratings = {};
        startNextRound(roomCode);
      } else {
        io.to(roomCode).emit('gameOver');
      }
    }
  });

  socket.on('leaderNextRound', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.leader !== socket.id || !room.waitingForNext) return;
    room.waitingForNext = false;
    room.currentRound++;
    if (room.currentRound < THEMES.length + 1) {
      room.drawings = {};
      room.ratings = {};
      startNextRound(roomCode);
    } else {
      io.to(roomCode).emit('gameOver');
    }
  });

  // Drawing ready/Unready
socket.on('drawingReady', ({ roomCode, ready }) => {
  const room = rooms[roomCode];
  if (!room) return;
  if (!room.drawingReady) room.drawingReady = [];
  if (ready) {
    if (!room.drawingReady.includes(socket.id)) room.drawingReady.push(socket.id);
  } else {
    room.drawingReady = room.drawingReady.filter(id => id !== socket.id);
  }
  io.to(roomCode).emit('drawingReadyUpdate', {
    ready: room.drawingReady.length,
    total: room.players.length
  });
  // If all players are ready, move to showDrawings
  if (room.drawingReady.length === room.players.length) {
    room.drawingReady = [];
    io.to(roomCode).emit('showDrawings', room.drawings);
  }
});

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        // If leader left, assign new leader
        if (room.leader === socket.id && room.players.length > 0) {
          room.leader = room.players[0].id;
        }
        io.to(roomCode).emit('updatePlayers', room.players, room.leader, room.started);
        if (room.players.length === 0) delete rooms[roomCode];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});