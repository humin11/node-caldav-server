import express from 'express';
import calendarHandler from '../dao/calendar';

let router = express.Router();


router.propfind('/:username/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handlePropfind(req, res, next);
});

router.propfind('/:username/:calendar_id', function (req, res, next) {
  calendarHandler.handlePropfind(req, res, next);
});

router.propfind('/:username', function (req, res, next) {
  calendarHandler.handlePropfind(req, res, next);
});

router.proppatch('/:username/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handleProppatch(req, res, next);
});

router.options('/:username/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handleOptions(req, res, next);
});

router.options('/:username/:calendar_id', function (req, res, next) {
  calendarHandler.handleOptions(req, res, next);
});

router.options('/:username', function (req, res, next) {
  calendarHandler.handleOptions(req, res, next);
});

router.report('/:username/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handleReport(req, res, next);
});

// excuse me??? mkactivity or mkcalendar
// router.mkactivity('/:user/:ics_id', function(req, res, next) {
//   res.json(req.method);
// });

router.put('/:username/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handlePut(req, res, next);
});

router.put('/:username/:calendar_id/:ics_id/:new_ics_id', function (req, res, next) {
  calendarHandler.handleNewPut(req, res, next);
});

router.get('/:username/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handleGet(req, res, next);
});

router.delete('/:username/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handleDelete(req, res, next);
});

router.move('/:username/:calendar_id/:ics_id', function (req, res, next) {
  calendarHandler.handlePropfind(req, res, next);
});

// router.all('/:calendar_id/:ics_id', function (req, res, next) {
//   console.log('hello');
// });


module.exports = router;
