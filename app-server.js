var fs = require('fs');
// required if we are to run the server over hhtps
var https = require('https');
var express = require('express');
// socket.io-stream for managein binary streams on client and server
var ss = require('socket.io-stream');
// shell for managing shell command lines, specifically for sox to convert audio to falc
var shell = require('shelljs');
// set the server as a client to send socket to the file to text server
const URL_TEXT_SERVER = 'https://127.0.0.1:9006';
// Connect to server
var ioAsClient = require('socket.io-client');




var app = express();

//required key and cert for https, currently individual key from ioannis, there will be a browser warning for this
var options = {
  key: fs.readFileSync('./thesis-selfsignedkey.pem'),
  cert: fs.readFileSync('./thesis-selfsignedcrt.pem')
};

// ---------------ARCHITECTURE---------------------
// this server listens to requests from client and receives client wav file along with client metadata
// for getting and sending the wav file it requires socketio-stream
// it converts the wav file to flac and passes it to the file-to-text server
// so it requires shell to run flac in the command line
// it then gets back the transrcibed text

var serverPort = 9005;

var server = https.createServer(options, app);

//socket.io requirement and initialization
var ioAsServer = require('socket.io')(server);

app.use(express.static(__dirname + '/public'));

ioAsServer.on('connection', function(socketAsServer){
  
  console.log('new connection');
  // socket.io-stream event listening from the client
  ss(socketAsServer).on('client-stream-request', function(stream, objMetaData){
    // node filestream to save file on server filesystem
    var d = new Date();
    const filePrefix = objMetaData.studentName + 'TT' + d.getTime();
    const fileNameWAV = filePrefix + '.wav';
    const filePathWAV = `.\\audio_files\\${fileNameWAV}`;
    const fileNameFLAC = filePrefix + '.flac';
    const filePathFLAC = `.\\audio_files\\${fileNameFLAC}`;
    const fileNameTXT = filePrefix + '.txt';
    const filePathTXT = `.\\transcribed_files\\${fileNameTXT}`;
    //console.log(fileName);
    var writeStream = fs.createWriteStream(filePathWAV);
    stream.pipe(writeStream);
    // when file is completed
    stream.on('end', ()=>{
      socketAsServer.emit('stream-server-ended');
      // turn the wav file on file system to flac file
      shell.exec(`sox ${filePathWAV} --channels=1 --bits=16 --rate=16000 ${filePathFLAC} --norm`, {async:false});
      //shell.exec(`sox maria.wav --channels=1 --bits=16 --rate=16000 maria.flac --norm`, {async:false})
      // remove file from file system
      shell.rm(filePathWAV);
      //-----------app-server stream request to text-server--------------
      var socketioStreamToTextServer = ss.createStream();
      // the parameters of the connect function are required ton run under https
      var socketAsClient = ioAsClient.connect(URL_TEXT_SERVER, {secure: true, reconnect: true, rejectUnauthorized : false });
      // socketio-client requires that we listen to the connect event in order to inittiate anything
      socketAsClient.on('connect', () =>{
        // emit the flac file as stream along with the file name      
        ss(socketAsClient).emit('appserver-stream-request', socketioStreamToTextServer, {fileNameFLAC});
        //fs.createReadStream('maria.flac').pipe(socketioStreamToTextServer);
        fs.createReadStream(filePathFLAC).pipe(socketioStreamToTextServer);
        // listen to the event that fires when text comes back from text server and store the transcribed text
        socketAsClient.on('textserver-transcribebtext', (transcribedTextObj)=>{
          var transcribebtext = transcribedTextObj.transcribedText;
          // store the transcribed text to a file
          fs.writeFile(filePathTXT, transcribebtext, (err) => {
            if (err) {
              console.log(err);
              return;
            }
            console.log('file ' + fileNameTXT + ' written to transcribed_files directory');
            // console.log(transcribedTextObj.transcribedText);
          });
        });
      });

      //------------------------------------------------------------------
    });
  });
});



server.listen(serverPort, function(){
  console.log('HTTPS server up and running at %s port', serverPort);
});