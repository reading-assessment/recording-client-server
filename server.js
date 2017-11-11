var fs = require('fs');
var https = require('https');
var express = require('express');
var ss = require('socket.io-stream');
var shell = require('shelljs');
var admin = require('firebase-admin');
var Speech = require('@google-cloud/speech').SpeechClient;
//console.log(Speech);
var serviceAccount = require('./benkyohr-e00dc-firebase-adminsdk-125v5-d1fdc86be0.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "benkyohr-e00dc.appspot.com"
});

var app = express();

var options = {
  key: fs.readFileSync('./thesis-selfsignedkey.pem'),
  cert: fs.readFileSync('./thesis-selfsignedcrt.pem')
};

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
      shell.exec('sox test.wav --channels=1 --bits=16 --rate=16000 test.flac', {async:false});
      shell.rm('test.wav');
      var file = 'test.flac';
      var storageRef = admin.storage().bucket();
      storageRef.upload( file, { destination: 'test.flac', public: true })
      .then(function(response){
        console.log('upload completed');
        var bucketURI = 'gs://benkyohr-e00dc.appspot.com/test.flac';
        asyncRecognizeGCS(bucketURI, 'FLAC', 16000, 'en-US');
      })
      .catch(function(err){
        console.log(err);
      });
    });
  });
});



server.listen(serverPort, function(){
  console.log('HTTPS server up and running at %s port', serverPort);
});

//-------------------------------------------------------------------

function asyncRecognizeGCS (gcsUri, encoding, sampleRateHertz, languageCode) {
  // [START speech_async_recognize_gcs]
  // Imports the Google Cloud client library
  // const Speech = require('@google-cloud/speech');

  // Instantiates a client
  const speech = new Speech();

  // The Google Cloud Storage URI of the file on which to perform speech recognition, e.g. gs://my-bucket/audio.raw
  // const gcsUri = 'gs://my-bucket/audio.raw';

  // The encoding of the audio file, e.g. 'LINEAR16'
  // const encoding = 'LINEAR16';

  // The sample rate of the audio file in hertz, e.g. 16000
  // const sampleRateHertz = 16000;

  // The BCP-47 language code to use, e.g. 'en-US'
  // const languageCode = 'en-US';

  const config = {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode
  };

  const audio = {
    uri: gcsUri
  };

  const request = {
    config: config,
    audio: audio
  };

  // Detects speech in the audio file. This creates a recognition job that you
  // can wait for now, or get its result later.
  speech.longRunningRecognize(request)
    .then((data) => {
      const operation = data[0];
      // Get a Promise representation of the final result of the job
      return operation.promise();
    })
    .then((data) => {
      const response = data[0];
      const transcription = response.results.map(result =>
          result.alternatives[0].transcript).join('\n');
      console.log(`Transcription: ${transcription}`);
    })
    .catch((err) => {
      console.error('ERROR:', err);
    });
  // [END speech_async_recognize_gcs]
}