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

        console.log('no user provided nor calendar_id');
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

router.propfind('/:username?/:calendar_id?/:ics_id?', async function (...args) {
  await calendarHandler.handlePropfind(...args);
});

router.proppatch('/:username/:calendar_id/:ics_id', async function (...args) {
  await calendarHandler.handleProppatch(...args);
});

router.options('/:username/:calendar_id?/:ics_id?', function (...args) {
  calendarHandler.handleOptions(...args);
});

router.mkcol('/:username/:calendar_id?/:ics_id?', async function (...args) {
  await calendarHandler.handleMkcalendar(...args)
});

router.report('/:username?/:calendar_id?/:ics_id?', async function (...args) {
  await calendarHandler.handleReport(...args);
});

router.put('/:username?/:calendar_id?/:ics_id?', async function (...args) {
  await calendarHandler.handlePut(...args);
});

router.get('/:username/:calendar_id/:ics_id', async function (...args) {
  await calendarHandler.handleGet(...args);
});

router.delete('/:username/:calendar_id?/:ics_id?', async function (...args) {
  await calendarHandler.handleDelete(...args);
});

router.move('/:username/:calendar_id/:ics_id?', async function (...args) {
  await calendarHandler.handlePropfind(...args);
});

module.exports = router;
