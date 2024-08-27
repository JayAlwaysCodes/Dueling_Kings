console.log("Script.js is running");

import { Chess } from '/node_modules/chess.js/dist/esm/chess.js'; // or use require('chess.js').Chess

var board = null
var game = new Chess()
let playerName = "";
let gameMode = "";
let gameId = null;
let playerColor = ""; // Track the player's color (white or black)
let isWhite;
var $status = $('#status')
var $fen = $('#fen')
var $pgn = $('#pgn')
var whiteSquareGrey = '#a9a9a9'
var blackSquareGrey = '#696969'


function removeGreySquares () {
    $('#myBoard .square-55d63').css('background', '')
}
  
function greySquare (square) {
    var $square = $('#myBoard .square-' + square)

    var background = whiteSquareGrey
    if ($square.hasClass('black-3c85d')) {
        background = blackSquareGrey
    }

    $square.css('background', background)
}

function onDragStartSingle (source, piece, position, orientation) {
  // do not pick up pieces if the game is over
  if (game.isGameOver()) return false

  // only pick up pieces for the side to move
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }
   // only pick up pieces for White
   if (piece.search(/^b/) !== -1) return false
}

function onDragStartMulti(source, piece, position, orientation) {
    // do not pick up pieces if the game is over
    if (game.isGameOver()) return false;

    // Ensure players can only pick up pieces of their color
    if ((playerColor === 'black' && piece.search(/^w/) !== -1) || 
        (playerColor === 'white' && piece.search(/^b/) !== -1)) {
        return false;
    }

}

function makeRandomMove () {
    var possibleMoves = game.moves()
  
    // game over
    if (possibleMoves.length === 0) return
  
    var randomIdx = Math.floor(Math.random() * possibleMoves.length)
    game.move(possibleMoves[randomIdx])
    board.position(game.fen())
    updateStatus();
}

// Single-player mode onDrop function
function onDropSingle(source, target) {
    removeGreySquares();
    try {
        var move = game.move({
            from: source,
            to: target,
            promotion: 'q' // Always promote to a queen for simplicity
        });

        if (move === null) {
            return 'snapback';
        }

        window.setTimeout(makeRandomMove, 250); // Make a random legal move for black after a delay
    } catch (error) {
        return 'snapback';
    }
    updateStatus();
}

// Multiplayer mode onDrop function
function onDropMulti(source, target, piece) {
    removeGreySquares();
    if ((isWhite && piece.startsWith('b')) || (!isWhite && piece.startsWith('w'))) {
        return 'snapback'; // Prevent moving opponent's pieces
    }
    try {
        // Ensure that the player can only move pieces that match their color
        if ((game.turn() === 'w' && playerColor !== 'white') || 
            (game.turn() === 'b' && playerColor !== 'black')) {
            return 'snapback'; // Prevent the move if it's not the player's turn
        }

        var move = game.move({
            from: source,
            to: target,
            promotion: 'q' // Always promote to a queen for simplicity
        });

        if (move === null) return 'snapback';

        // Broadcast the move to the other player
        socket.emit('move', {
            gameId: gameId,
            from: source,
            to: target,
            fen: game.fen()
        });
        // Check if the game is over on the client side
        // if (game.isGameOver()) {
        //     let resultMessage;
        //     if (game.isCheckmate()) {
        //         resultMessage = 'Checkmate!';
        //     } else if (game.isDraw()) {
        //         resultMessage = 'Draw!';
        //     } else if (game.isStalemate()) {
        //         resultMessage = 'Stalemate!';
        //     } else if (game.isThreefoldRepetition()) {
        //         resultMessage = 'Threefold Repetition!';
        //     } else if (game.isInsufficientMaterial()) {
        //         resultMessage = 'Insufficient Material!';
        //     } else if (game.isTimeout()) {
        //         resultMessage = 'Timeout!';
        //     }
        //     // Notify the server that the game is over
        //     socket.emit('gameEnded', {
        //         gameId: gameId,
        //         result: resultMessage,
        //         isCheckmate: isCheckmate
        //     });
            // Update the UI with the result
            //alert(`Game Over: ${resultMessage}`);
        //}

    } catch (error) {
        console.error("Error occurred while making move:", error);
        return 'snapback';
    }
    updateStatus();
}




function onMouseoverSquare (square, piece) {
    // get list of possible moves for this square
    var moves = game.moves({
      square: square,
      verbose: true
    })
  
    // exit if there are no moves available for this square
    if (moves.length === 0) return
  
    // highlight the square they moused over
    greySquare(square)
  
    // highlight the possible squares for this piece
    for (var i = 0; i < moves.length; i++) {
      greySquare(moves[i].to)
    }
}
  
function onMouseoutSquare (square, piece) {
    removeGreySquares()
}



// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
  board.position(game.fen())
}

function updateStatus() {
    var status = '';

    // Determine whose turn it is
    var moveColor = (game.turn() === 'w') ? 'White' : 'Black';
    if (gameMode === 'single') {
        var moveColor = (game.turn() === 'w') ? playerName : 'Computer';
    } else if (gameMode === 'multi') {
        var moveColor = 'White';
        if (game.turn() === 'b') {
            moveColor = 'Black';
        }
    }

    // Checkmate?
    if (game.isCheckmate()) {
        status = 'Game over, ' + moveColor + ' is in checkmate.';
    } 
    // Draw?
    else if (game.isDraw()) {
        status = 'Game over, drawn position';
    } 
    // Game still on
    else {
        status = moveColor + ' to move';

        // Check?
        if (game.isCheck()) {
            status += ', ' + moveColor + ' is in check';
        }
    }

    $status.html(status);
    $fen.html(game.fen());
    $pgn.html(game.pgn());
}

function registerPlayerIfNeeded() {
    if (!playerName) {
        playerName = $('#playerName').val() || 'Player';
    }

    socket.emit('registerPlayer', { name: playerName }, (response) => {
        if (response.success) {
            console.log('Player registered successfully.');
        } else {
            console.error('Player registration failed:', response.message);
        }
    });
}

document.getElementById('restartGame').addEventListener('click', function() {
    game.reset();
    board.start();
    updateStatus();
});

document.getElementById('exitGame').addEventListener('click', function() {
    // Refresh the page to reset the game and return to the name entry screen
    window.location.reload();
});

// Setup buttons for player input
$('#singlePlayerBtn').on('click', function() {
    playerName = $('#playerName').val() || 'Player';
    gameMode = 'single';
    $('#setup').hide();
    $('#gameContainer').show();

    // Update the config for single-player mode
 
    board = Chessboard('myBoard', configSingle);
    game.reset();
    updateStatus();
});

const socket = io('http://localhost:5501'); // Connect to the Socket.io server on port 5500

// Test Socket.io connection
socket.on('testMessage', (message) => {
    console.log(message); // Should log "Socket.io is working!"
});


$('#multiPlayerBtn').on('click', function() {
    gameMode = 'multi';
    $('#setup').hide();
    $('#multiplayerPopup').show();

    // Update the config for multiplayer mode
    registerPlayerIfNeeded();
    board = Chessboard('myBoard', configMulti);
    updateStatus();
    
});

$('#loginConnectBtn').on('click', function() {
    $('#multiplayerPopup').hide();
    $('#createOrJoin').show();
});

// Handle create or join option selection
$('#createPlayOption').on('click', function() {
    $('#createOrJoin').hide();
    $('#createPlay').show();

    // Request the list of available plays from the server
    socket.emit('requestPlayList');
});

$('#joinPlayOption').on('click', function() {
    $('#createOrJoin').hide();
    $('#joinPlay').show();
});

// Handle create play button click
$('#createPlayBtn').on('click', function() {
    const asset = $('#asset').val();
    const amount = $('#amount').val();

    if (asset && amount) {
        socket.emit('createPlay', { asset, amount });
        $('#createPlay').hide();
        $('#waitingRoom').show(); // Assuming you have a waiting room or placeholder
    } else {
        alert('Please enter both asset and amount.');
    }
});

// Handle join play button click
function joinPlay(gameId) {
    //console.log("Attempting to join play with ID:", gameId); // Debugging
    socket.emit('joinPlay', gameId);
    $('#joinplay').hide(); // Ensure this ID exists and is correct
    $('#waitingRoom').show(); // Ensure this ID exists and is correct
    
}

// Function to update stake display
function updateStakeDisplay(asset, amount) {
    $('#stakedAsset').text('Asset: ' + asset);
    $('#stakedAmount').text('Amount: ' + amount);
    $('#stakeDisplay').show(); // Make sure the stake display is visible
}

// Listen for playCreated event
socket.on('playCreated', (data) => {
    alert('Play created! Game ID: ' + data.gameId);
    $('#waitingRoom').show(); // Show the waiting room
    updateStakeDisplay(data.asset, data.amount); // Update stake display
});

// Listen for the updated list of available plays
socket.on('updatePlayList', (plays) => {
    const playList = $('#playList');
    playList.empty(); // Clear the list

    if (plays.length === 0) {
        playList.append('<div>No available plays at the moment.</div>');
    } else {
        plays.forEach(play => {
            // Use jQuery to handle dynamic event binding
            const button = $('<button>Join</button>').data('id', play.id).text('Join');
            button.on('click', function() {
                joinPlay($(this).data('id'));
            });

            playList.append(`
                <div>
                    <span>Asset: ${play.asset}, Amount: ${play.amount}</span>
                </div>
            `).append(button);
        });
    }
});

// Listen for playJoined event
socket.on('playJoined', (data) => {
    alert('Joined play with asset: ' + data.asset + ' and amount: ' + data.amount);
    $('#joinPlay').hide();
    $('#waitingRoom').hide(); // Hide the waiting room
    $('#gameContainer').show(); // Show the game board
    updateStakeDisplay(data.asset, data.amount); // Update stake display

    //Initialize the chessboard for multiplayer mode
    board = Chessboard('myBoard', configMulti)

    
    updateStatus();
});

// Listen for gameStarted event
socket.on('gameStarted', (data) => {
    alert('Game started with ID: ' + data.gameId);
    $('#waitingRoom').hide(); // Hide the waiting room
    $('#gameContainer').show(); // Show the game board
    gameId = data.gameId
    isWhite = data.isWhite

    // Assign player color based on whether they are the creator or joiner
    playerColor = data.isWhite ? 'white' : 'black';
    alert(data.message);

    // Set board orientation and initialize it
    let orientation = playerColor;

    // Initialize the chessboard with the appropriate orientation
    if (isWhite) {
        board.orientation('white');
    } else {
        board.orientation('black');
    }
    
    board = Chessboard('myBoard', configMulti);

    game.reset();
    updateStatus();
});

socket.on('move', (data) => {
    game.move({
        from: data.from,
        to: data.to,
        promotion: 'q' // Assuming promotion to queen
    });
    board.position(data.fen);
    updateStatus();
});

// Listen for gameEnded event
socket.on('gameEnded', (data) => {
    if (data.winnerId === socket.id) {
        alert(`Game Over: ${data.result}. You won ${data.totalWinnings} ${data.asset}.`);
    } else if (data.loserId === socket.id) {
        alert(`Game Over: ${data.result}. You lost ${data.amountLost} ${data.asset}.`);
    } else {
        alert(`Game Over: ${data.result}.`);
    }

    // Reload the window after a short delay to allow the alert to be read
    setTimeout(() => {
        location.reload();
    },3000);
});

// Optionally, handle errors if the play is no longer available
socket.on('error', (error) => {
    alert(error.message);
});

let configMulti = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStartMulti,
    onDrop: onDropMulti,
    onMouseoverSquare: onMouseoverSquare,
    onMouseoutSquare: onMouseoutSquare,
    onSnapEnd: onSnapEnd,
  pieceTheme: 'img/{piece}.png'
}
let configSingle = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStartSingle,
    onDrop: onDropSingle,
    onMouseoverSquare: onMouseoverSquare,
    onMouseoutSquare: onMouseoutSquare,
    onSnapEnd: onSnapEnd,
  pieceTheme: 'img/{piece}.png'
}


updateStatus()