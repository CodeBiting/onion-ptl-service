// global variable to use in require
global.__base = __dirname + '/';

var createError = require('http-errors');
var bodyParser = require('body-parser');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var morgan = require('morgan');

const logger = require('./api/logger');
const ApiResult = require(`${__base}api/ApiResult`);
const ApiError = require(`${__base}api/ApiError`);

// Configuration WEB
const indexRouter = require('./routes/index');

// API V1
const apiDocsV1 = require('./routes/api/v1/api-docs');
const apiMovementRouterV1 = require('./routes/api/v1/movement');
const apiLocationRouterV1 = require('./routes/api/v1/location');
const helpRouterV1 = require('./routes/api/v1/help');


const HELP_BASE_URL = '/v1/help/error';

var app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Morgan log formats:
// combined   :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version"
//            :status :res[content-length] ":referrer" ":user-agent"
// dev        :method :url :status :response-time ms - :res[content-length]
// common     :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version"
//            :status :res[content-length]
// short      :remote-addr :remote-user :method :url HTTP/:http-version :status 
//            :res[content-length] - :response-time ms
// tiny       :method :url :status :res[content-length] - :response-time ms
const morganFormat = process.env.NODE_ENV !== 'production' ? 'dev' : 'combined';
// const morganFormat = "combined";
app.use(
  morgan(morganFormat, {
    // Function to determine if logging is skipped, defaults to false
    // skip: function(req, res) {
    //   // Skip logging when function has exit (returns status code < 400)
    //   return res.statusCode < 400;
    // },
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  })
);

// Routes after morgan use to log each call
app.use('/', indexRouter);
app.use('/api/v1/api-docs', apiDocsV1);
app.use('/api/v1/movement', apiMovementRouterV1);
app.use('/api/v1/location', apiLocationRouterV1);
app.use('/api/v1/help', helpRouterV1);

logger.info(`Node environment = ${(process.env.NODE_ENV ? process.env.NODE_ENV : 'development')}`);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  //next(createError(404));
  let status = 404;
  logger.error(`ExpressJS: [${req.method}] ${req.originalUrl}: ${status}: Not found`);
  let error = new ApiError('NOT-FOUND-ERROR-001', 'Not found', '', `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/NOT-FOUND-ERROR-001`);
  res.status(status).json(new ApiResult("ERROR", null, [ error ]));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  //res.status(err.status || 500);
  //res.render('error');

  let status = err.status || 500;
  logger.error(`ExpressJS: [${req.method}] ${req.originalUrl}: ${status}: ${err.message}`);
  let error = new ApiError('GENERIC-ERROR-001', err.message, '', `${req.protocol}://${req.get('host')}${HELP_BASE_URL}/GENERIC-ERROR-001`);
  res.status(status).json(new ApiResult("ERROR", null, [ error ]));
});

module.exports = app;
