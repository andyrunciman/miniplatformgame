const express = require('express');
const http = require('http');

const app = express();
app.use(express.static('static'));
const server = http.createServer(app);
server.listen(8080, () => {
  console.log('server started');
});
