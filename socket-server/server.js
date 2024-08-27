const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 5501;

// import { Chess } from '/node_modules/chess.js/dist/esm/chess.js';
const Chess = require('chess.js').Chess
// let chess = new Chess();


// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, '../public')));

// Data storage for active games and players
let plays = []; // Store the list of plays
let players = {};

// Handle Socket.io connections
io.on('connection', (socket) => {
    console.log('A user connected', socket.id);

    // Notify client that socket connection is working
    socket.emit('testMessage', 'Socket.io is working!');

    // Handle player registration
    socket.on('registerPlayer', (playerName) => {
        players[socket.id] = { name: playerName, gameId: null };
        io.emit('updatePlayers', players);
    });
    
    // Handle player registration (or auto-registration if not already registered)
    function ensurePlayerRegistration(socket, playerName) {
        if (!players[socket.id]) {
            console.log(`Auto-registering player with ID: ${socket.id}, Name: ${playerName}`);
            players[socket.id] = { name: playerName, gameId: null };
            io.emit('updatePlayers', players);
        }
    }

    // Handle play creation
    socket.on('createPlay', (data) => {
        ensurePlayerRegistration(socket, data.playerName);
    
        const play = {
            id: 'game-' + Date.now(),
            asset: data.asset,
            amount: data.amount,
            creatorId: socket.id,
            creatorName: players[socket.id].name,
            creatorColor: 'white',  // Assign white to creator
            joinerId: null,
            joinerName: null,
            joinerColor: null,  // Will be assigned when a player joins
            status: 'waiting'
        };
    
        plays.push(play);
        io.emit('playCreated', play)
        io.emit('updatePlayList', plays.filter(p => p.status === 'waiting'));

        
    });
    
    

    // When a joiner requests the list of available plays
    socket.on('requestPlayList', () => {
        const availablePlays = plays.filter(play => play.status === 'waiting');
        socket.emit('updatePlayList', availablePlays);
    });
    
    // Handle joining a play
    socket.on('joinPlay', (gameId) => {
        ensurePlayerRegistration(socket, players[socket.id]?.name || 'Unknown');
    
        const play = plays.find(p => p.id === gameId);
        if (play && play.status === 'waiting') {
            console.log('Player joined game:', play);
            play.joinerId = socket.id;
            play.joinerName = players[socket.id].name;
            play.joinerColor = 'black';  // Assign black to joiner
            play.status = 'started';

            // Initialize a new Chess instance for this game
            play.chessInstance = new Chess();
            
            io.to(play.creatorId).emit('playJoined', play);
            socket.emit('playJoined', play);
    
            // Notify players of their colors
            io.to(play.creatorId).emit('gameStarted', {
                gameId: gameId,
                isWhite: true,  // Creator is white
                message: 'You are playing as White.'
            });
            socket.emit('gameStarted', {
                gameId: gameId,
                isWhite: false,  // Joiner is black
                message: 'You are playing as Black.'
            });
        } else {
            socket.emit('error', { message: 'This play is no longer available.' });
        }
    });
    

    // Broadcast moves between players
    socket.on('move', (data) => {
        const play = plays.find(p => p.id === data.gameId);
        if (play) {
            const chess = play.chessInstance;  // Use the specific game's chess instance

            // Update the chess game state on the server
            play.chessInstance.move({
                from: data.from,
                to: data.to,
                promotion: 'q' // Assuming promotion to queen
            });
    
            const opponentSocketId = socket.id === play.creatorId ? play.joinerId : play.creatorId;
            socket.to(opponentSocketId).emit('move', data);
    
            
            // Check if the game is over
            if (play.chessInstance.isGameOver()) {
                console.log('The game has ended.');

                let resultMessage;
                if (play.chessInstance.isCheckmate()) {
                    resultMessage = 'Checkmate!';
                } else if (play.chessInstance.isDraw()) {
                    resultMessage = 'Draw!';
                } else if (play.chessInstance.isStalemate()) {
                    resultMessage = 'Stalemate!';
                } else if (play.chessInstance.isThreefoldRepetition()) {
                    resultMessage = 'Threefold Repetition!';
                } else if (play.chessInstance.isInsufficientMaterial()) {
                    resultMessage = 'Insufficient Material!';
                } else if (play.chessInstance.isTimeout()) {
                    resultMessage = 'Timeout!';
                }

                let winnerId, loserId;
                if (play.chessInstance.isCheckmate()) {
                    const loserColor = play.chessInstance.turn() === 'w' ? 'white' : 'black';
                    winnerId = loserColor === play.creatorColor ? play.joinerId : play.creatorId;
                    loserId = winnerId === play.creatorId ? play.joinerId : play.creatorId;
                } else {
                    winnerId = null; // For non-checkmate endings, we treat it as a draw
                    loserId = null;
                }

                if (winnerId && loserId) {
                    const totalWinnings = play.amount * 2; // Assuming each player stakes the same amount

                    // Notify the winner
                    io.to(winnerId).emit('gameEnded', {
                        result: resultMessage,
                        winnerId: winnerId,
                        loserId: loserId,
                        totalWinnings: totalWinnings,
                        asset: play.asset,
                        amountLost: play.amount
                    });

                    // Notify the loser
                    io.to(loserId).emit('gameEnded', {
                        result: resultMessage,
                        winnerId: winnerId,
                        loserId: loserId,
                        totalWinnings: totalWinnings,
                        asset: play.asset,
                        amountLost: play.amount
                    });
                } else {
                    // In case of a draw or other non-checkmate endings
                    io.to(play.creatorId).emit('gameEnded', { result: resultMessage });
                    io.to(play.joinerId).emit('gameEnded', { result: resultMessage });
                }
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);

        const playerGame = plays.find(play => play.creatorId === socket.id || play.joinerId === socket.id);
        if (playerGame) {
            // If the disconnected player was part of an active game, notify the other player
            const opponentSocketId = socket.id === playerGame.creatorId ? playerGame.joinerId : playerGame.creatorId;
            if (opponentSocketId) {
                io.to(opponentSocketId).emit('opponentDisconnected');
            }

            // Remove the game
            plays = plays.filter(play => play.id !== playerGame.id);
        }

        // Remove player from players list
        delete players[socket.id];
        io.emit('updatePlayers', players);

        // Remove any games created or joined by the disconnected player
        io.emit('updatePlayList', plays.filter(p => p.status === 'waiting'));
    });
});

server.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});