var fs = require('fs');
var https = require('https');
var express = require('express');
var ss = require('socket.io-stream');
var shell = require('shelljs');

var app = express();

var options = {
  key: fs.readFileSync('./thesis-selfsignedkey.pem'),
  cert: fs.readFileSync('./thesis-selfsignedcrt.pem')
};

// var outFile = 'demo.wav';
var serverPort = 9005;

var server = https.createServer(options, app);

var io = require('socket.io')(server);

app.use(express.static(__dirname + '/public'));



io.on('connection', function(socket){
  console.log('new connection');
  ss(socket).on('client-stream-request', function(stream, size){
    var writeStream = fs.createWriteStream('test.wav');
    stream.pipe(writeStream);
    stream.on('end', ()=>{
      console.log('ended');
      shell.exec('sox test.wav --channels=1 --bits=16 --rate=16000 test.flac', {async:false});
      shell.rm('test.wav');
    });
  });
  //socket.emit('message', 'TESSSST');
});

server.listen(serverPort, function(){
  console.log('HTTPS server up and running at %s port', serverPort);
});