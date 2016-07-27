import express from 'express';
import calendarHandler from '../dao/calendar';

let router = express.Router();


router.propfind('/', function (req, res, next) {
  calendarHandler.handlePropfind(req, res, next);
});

router.proppatch('/', function (req, res, next) {
  calendarHandler.handleProppatch(req, res, next);
});

router.options('/', function (req, res, next) {
  calendarHandler.handleOptions(req, res, next);
});

router.report('/', function (req, res, next) {
  calendarHandler.handleReport(req, res, next);
});

// excuse me??? mkactivity or mkcalenda
// router.mkactivity('/', function(req, res, next) {
//   res.json(req.method);
// });

router.put('/', function (req, res, next) {
  calendarHandler.handlePut(req, res, next);
});

router.get('/', function (req, res, next) {
  calendarHandler.handleGet(req, res, next);
});

router.delete('/', function (req, res, next) {
  calendarHandler.handleDelete(req, res, next);
});

router.move('/', function (req, res, next) {
  calendarHandler.handlePropfind(req, res, next);
});

router.all('/', function (req, res, next) {
  console.log('hello');
});


module.exports = router;
