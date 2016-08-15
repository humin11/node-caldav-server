import express from 'express';
import calendarHandler from '../dao/calendar';

let router = express.Router({
  caseSensitive : true,
});

const parseName = name => name.split('.')[0];

router.use('/:username?/:calendar_id?/:ics_id?', function(req,res,next){
  
  if(typeof req.params.username != "undefined"){
    if(req.params.username == req.user){
      res.locals.username = req.user;
    }else{

      if(typeof req.params.calendar_id !="undefined"){
        // username not equals to req.user
        // should only read calendar
        res.locals.username = req.params.username

      }else{
        // none user provided nor calendar_id, but only provide ics_id
        // so just apply default value to username && calendar_id
        res.locals.username = req.user;
        res.locals.calendar_id = req.user;
        res.locals.ics_id = parseName(req.params.username);

        console.log(`-url: ${req.url}`);
        console.log(`-username: ${res.locals.username}`);
        console.log(`-calendar_id: ${res.locals.calendar_id}`);
        console.log(`-ics_id: ${res.locals.ics_id}`);
        next();
        return;
      }
    }
    
  }else{
    res.locals.username = req.user;
  }

  if(typeof req.params.calendar_id != "undefined"){
    res.locals.calendar_id = parseName(req.params.calendar_id)
  }else{
    res.locals.calendar_id = res.locals.username;
  } 

  if(typeof req.params.ics_id != "undefined"){
    res.locals.ics_id = parseName(req.params.ics_id)
  }else{
    res.locals.ics_id = res.locals.calendar_id;
  } 

  console.log(`url: ${req.url}`);
  console.log(`username: ${res.locals.username}`);
  console.log(`calendar_id: ${res.locals.calendar_id}`);
  console.log(`ics_id: ${res.locals.ics_id}`);

  next();

});

router.propfind('/:username?/:calendar_id?/:ics_id?', async function (req, res, next) {
  await calendarHandler.handlePropfind(req, res, next);
});

router.proppatch('/:username/:calendar_id/:ics_id', async function (req, res, next) {
  await calendarHandler.handleProppatch(req, res, next);
});

router.options('/:username/:calendar_id?/:ics_id?', function (req, res, next) {
  calendarHandler.handleOptions(req, res, next);
});

router.report('/:username?/:calendar_id?/:ics_id?', async function (req, res, next) {
  await calendarHandler.handleReport(req, res, next);
});

router.put('/:username?/:calendar_id?/:ics_id?', async function (req, res, next) {
  await calendarHandler.handlePut(req, res, next);
});

router.get('/:username/:calendar_id/:ics_id', async function (req, res, next) {
  await calendarHandler.handleGet(req, res, next);
});

router.delete('/:username/:calendar_id?/:ics_id?', async function (req, res, next) {
  await calendarHandler.handleDelete(req, res, next);
});

router.move('/:username/:calendar_id/:ics_id?', async function (req, res, next) {
  await calendarHandler.handlePropfind(req, res, next);
});

module.exports = router;
