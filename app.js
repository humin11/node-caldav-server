var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

require('babel-core/register');

var log = require('./utils/log');
var routes = require('./routes/index');
var calendars = require('./routes/calendars');
var principles = require('./routes/principals');

require('./dao/db');

var app = express();

var httpauth = require('http-auth'); 
var authentication = require('./service/authentication');
var basic = httpauth.basic({
        realm: "Caldav"
    }, function (username, password, callback) { 
        authentication(username,password,callback);
    }
);


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));

require('body-parser-xml')(bodyParser);

app.use(bodyParser.raw({
  type: function(req){
    var contentType = req.headers['content-type'];
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

app.use(httpauth.connect(basic));

app.use('/',principles);
app.use('/p',principles);
app.use('/cal',calendars);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
