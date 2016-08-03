import express from 'express';
import calendarHandler from '../dao/calendar';

let router = express.Router();


router.propfind('/:user/:ics', function (req, res, next) {
  calendarHandler.handlePropfind(req, res, next);
});

router.proppatch('/:user/:ics', function (req, res, next) {
  calendarHandler.handleProppatch(req, res, next);
});

router.options('/:user/:ics:user/:ics', function (req, res, next) {
  calendarHandler.handleOptions(req, res, next);
});

router.report('/:user/:ics', function (req, res, next) {
  calendarHandler.handleReport(req, res, next);
});

// excuse me??? mkactivity or mkcalenda
// router.mkactivity('/:user/:ics', function(req, res, next) {
//   res.json(req.method);
// });

router.put('/:user/:ics', function (req, res, next) {
  calendarHandler.handlePut(req, res, next);
});

router.get('/:user/:ics', function (req, res, next) {
  calendarHandler.handleGet(req, res, next);
});

router.delete('/:user/:ics', function (req, res, next) {
  calendarHandler.handleDelete(req, res, next);
});

router.move('/:user/:ics', function (req, res, next) {
  calendarHandler.handlePropfind(req, res, next);
});

router.all('/:user/:ics', function (req, res, next) {
  console.log('hello');
});


module.exports = router;
