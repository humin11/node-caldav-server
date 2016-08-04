import express from 'express';
import calendarHandler from '../dao/calendar';

let router = express.Router();


router.propfind('/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handlePropfind(req, res, next);
});

router.proppatch('/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handleProppatch(req, res, next);
});

router.options('/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handleOptions(req, res, next);
});

router.report('/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handleReport(req, res, next);
});

// excuse me??? mkactivity or mkcalenda
// router.mkactivity('/:user/:ics_id', function(req, res, next) {
//   res.json(req.method);
// });

router.put('/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handlePut(req, res, next);
});

router.get('/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handleGet(req, res, next);
});

router.delete('/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handleDelete(req, res, next);
});

router.move('/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handlePropfind(req, res, next);
});

// router.all('/:calendar_id/:ics_id', function (req, res, next) {
//   console.log('hello');
// });


module.exports = router;
