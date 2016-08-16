var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

// add babel hook
require('babel-core/register');

// load routes and log
var log = require('./utils/log');
var calendars = require('./routes/calendars');
var principals = require('./routes/principals');

// init database setting
require('./dao/db');

var app = express();

app.use(logger('dev'));


// parse text/calendar request
app.use(bodyParser.raw({
  type: function(req){
    var contentType = req.headers['content-type'];
    if(!contentType){
      return false;
    }
    var defaultParseArr = ['text/calendar'];
    var shouldParse = false;
    defaultParseArr.forEach(function(item,index){
      if(contentType.indexOf(item) != -1){
        shouldParse = true;
      }
    });
    return shouldParse; 
  },
  verify: function(req, res, buf, encoding) {
    if(buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }
}));

// parse application/xml request
require('body-parser-xml')(bodyParser);
app.use(bodyParser.xml({
  limit: '1MB',   // Reject payload bigger than 1 MB
  xmlParseOptions: {
    normalize: true,     // Trim whitespace inside text nodes
    normalizeTags: true, // Transform tags to lowercase
    explicitArray: false // Only put nodes in array if >1
  },
  verify: function(req, res, buf, encoding) {
    if(buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// add http basic authentication
var httpauth = require('http-auth'); 
var authentication = require('./service/authentication');
var basic = httpauth.basic({
        realm: "Caldav"
    }, function (username, password, callback) { 
       authentication(username,password,callback);
    }
);
app.use(httpauth.connect(basic));

// mount routes to paths
var config = require('./conf/config')
app.use('/',principals);
app.use(config.mountedPath.calDavPath,calendars);
app.use(config.mountedPath.principalPath,principals);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({
      'error':{
        message: err.message,
        error: err
      }
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    'error':{
      message: err.message,
      error: {}
    }
  });
});


module.exports = app;
