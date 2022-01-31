const http = require("http");
const express = require("express");
const WebSocket = require('ws');
const { uuid } = require('uuidv4');
const app = express();
const firebase = require('firebase');

app.use(express.static("public"));

app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"))
app.get("/join", (req, res) => res.sendFile(__dirname + "/public/join.html"))

app.listen(9091, () => console.log("Listening on http port 9091"))

const clients = new Map();
const questions = new Map();
const podium = new Map();

let gameAlreadyStarted = false;
let questionIndex = 0;

const games = {};
const firebaseConfig = {
  apiKey: "AIzaSyA-jj9jggcqlqTa_0fRJEuCMy5q4B2HLDw",
  authDomain: "guessgame-33328.firebaseapp.com",
  databaseURL: "https://guessgame-33328-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "guessgame-33328",
  storageBucket: "guessgame-33328.appspot.com",
  messagingSenderId: "455112741565",
  appId: "1:455112741565:web:a6343cf1b71af843885dd4"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
// Get a reference to the database service
var database = firebase.database();
const dbRef = database.ref().once('value', (snapshot) => {
  snapshot.forEach((childSnapshot) => {
    questions.set(childSnapshot.key, {"soru": childSnapshot.val().soru, "cevap": childSnapshot.val().cevap})
  })
});

const wsServer = new WebSocket.Server({ port: 9090 });

wsServer.on("connection", connection => {
    const id = uuid();
    const role = "";
    const gameId = "";
    clients.set(connection, { id, role, gameId });
    connection.on("message", message => {
        const result = JSON.parse(message);

        if (result.method === "connect") {
          let payLoad = {
              "method": "connect",
              "clientId": id
          };
          connection.send(JSON.stringify(payLoad));
        }

        if (result.method === "create") {

            clients.get(connection).role = result.role;

            const gameId = gamePin();

            games[gameId] = {
                "id": gameId,
                "clients": []
            }

            let payLoad = {
                "method": "create",
                "game": games[gameId],
                "clientId": id
            };
            [...clients.keys()].forEach((connection) => {
                connection.send(JSON.stringify(payLoad));
            });
        }

        //a client want to join
        if (result.method === "join") {

            const gameId = result.gameId;
            const username = result.username
            const role = result.role
            const game = games[gameId];
            const client = clients.get(connection);

            client.role = role;
            client.gameId = gameId;
            if(game !== undefined && gameAlreadyStarted == false) {
            game.clients.push({
                "clientId": id,
                "username": username,
                "role": role,
                "gameId": gameId
            })

            let payLoad = {
                "method": "join",
                "game": game,
                "clientId": id,
            };

            [...clients.keys()].forEach((connection) => {
              if (clients.get(connection).id === id || clients.get(connection).role === "admin") {
                connection.send(JSON.stringify(payLoad));
              }
            });
          } else {
            let payLoad = {
                "method": "non_valid_game"
            };

            [...clients.keys()].forEach((connection) => {
              if (clients.get(connection).id === id) {
                connection.send(JSON.stringify(payLoad));
              }
            });
          }
        }

        //a user plays
        if (result.method === "guess") {
          gameAlreadyStarted = true;
          questionIndex = result.index;

          if(questionIndex === questions.size) {
            let payLoad = {
                "method": "finish"
            };

            [...clients.keys()].forEach((connection) => {
              connection.send(JSON.stringify(payLoad));
            });
          } else {
            let payLoad = {
                "method": "guess",
                "question": questions.get(questionIndex.toString()).soru,
                "clientId": id,
                "isLastQuestion": questionIndex === (questions.size - 1)
            };

            [...clients.keys()].forEach((connection) => {
              connection.send(JSON.stringify(payLoad));
            });
          }


        }

        //a user submit an answer
        if(result.method === "answer") {
          let score = Math.abs(questions.get(questionIndex.toString()).cevap - Number(result.answer))
          let payLoad = {
            "method": "answer",
            "score": score,
            "guess": Number(result.answer) - questions.get(questionIndex.toString()).cevap,
            "total": score + result.score,
          };
          podium.set(id, {
            "username": result.username,
            "score": Number(result.answer) - questions.get(questionIndex.toString()).cevap,
            "total": score + result.score
          });
          [...clients.keys()].forEach((connection) => {
            if (clients.get(connection).id === result.clientId) {
              connection.send(JSON.stringify(payLoad));
            }
          });
        }

        //calculate podium
        if (result.method === "calculate") {
            const podiumSortedArray = [...podium].sort((a, b) => a[1].total - b[1].total);
            let payLoad = {
              "method": "calculate",
              "podium": podiumSortedArray
            };
            [...clients.keys()].forEach((connection) => {
              connection.send(JSON.stringify(payLoad));
            });
        }

        if (result.method === "player_left") {
          const gameId = result.gameId;
          let payLoad = {
            "method": "player_left",
            "clientId": result.clientId
          };
          console.log(result.clientId);
          [...clients.keys()].forEach((connection) => {
              connection.send(JSON.stringify(payLoad));
          });
          const game = games[gameId];
          console.log(game.clients);
          game.clients.forEach((client, index) => {
            if (client.clientId === result.clientId) {
              game.clients.splice(index, 1);
            }
          })
          console.log(game.clients);
        }
    });

    connection.on("open", () => {
      console.log("opened!")
    })
    connection.on("close", () => {
      console.log("closed!")
      let payLoad = {
        "method": "player_left",
        "clientId": clients.get(connection).id
      };
      const gameId = clients.get(connection).gameId;
      if (clients.get(connection).role === "admin") {
        gameAlreadyStarted = false;
        podium.clear();
      }
      if(gameId !== "" && games[gameId] !== undefined) {
        games[gameId].clients = games[gameId].clients.filter((clientId) => {
          return clientId === clients.get(connection).id
        });
        clients.delete(connection);
        [...clients.keys()].forEach((connection) => {
            connection.send(JSON.stringify(payLoad));
        });
      }
    })
});


function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

// then to call it, plus stitch in '4' in the third group
const guid = () => (S4() + S4() + "-" + S4() + "-4" + S4().substr(0, 3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();

const gamePin = () => Math.random().toString().substr(2, 6);
