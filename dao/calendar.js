import { USER,ICS,CAL,sequelize } from './db'
import log from '../utils/log'
import helper from '../conf/caldavHelper'

export default {
    handlePropfind,
    handleProppatch,
    handleOptions,
    handleReport,
    handlePut,
    handleGet,
    handleDelete,
    handleMove,
    handleMkcalendar,
}

function handlePropfind(req,res,next){

}

function handleMkcalendar(req,res,next){

}

function handleReport(req,res,next){

}

function handleProppatch(req,res,next){

}

function handleOptions(req,res,next){
    log.debug("principal.options called");

    helper.setStandardHeaders(request);
    helper.setDAVHeaders(request);

    res.status(200).end();
}

function handlePut(req,res,next){
    log.debug("calendar.put called");

    var ics_id = req.params.ics_id.split('.')[0];
    var calendar_id = req.params.calendar_id;

    var defaults = {
        calendarId: calendar_id,
        content: req.rawBody,
    };

    ICS
       .findOrCreate({ where: {pkey: ics_id}, defaults: defaults})
       .spread(function(ics, created){
            if(created){
                log.debug('Created ICS: ' + JSON.stringify(ics, null, 4));
            }else{
                ics.content = req.rawBody;
                log.debug('Loaded ICS: ' + JSON.stringify(ics, null, 4));
            }

            ics.save().then(function(){
                log.info('ics updated');
                CAL.findOne({ where: {pkey: calendar_id} } ).then(function(cal){
                    if(cal !== null && cal !== undefined){
                        cal.increment('synctoken', { by: 1 }).then(function(){
                            log.info('synctoken on cal updated');
                        });
                    }
                });
            });
        });

    helper.setStandardHeaders(request);

    var date = new Date();
    res.set("ETag", Number(date));

    res.status(201).end();
}

function handleGet(req,res,next){
    log.debug("calendar.get called");

    res.set("Content-Type", "text/calendar");

    var ics_id = req.params.ics_id.split('.')[0];

    (async function(){

        let ics = await ICS.find( { where: {pkey: ics_id}});

        if(!ics){
            log.warn('calendar GET err: could not find ics');
        }else{
            log.warn('calendar GET ok')
            var content = ics.content;
            //content = content.replace(/\r\n|\r|\n/g,'&#13;\r\n');

            res.write(content);
        }
        res.status(200).end();

    })();
}

function handleDelete(req,res,next){
    log.debug("calendar.delete called");

    res.set("Content-Type", "text/html");
    res.set("Server", "Caldav");

    

    var isRoot = true;

    // if URL element size === 4, this is a call for the root URL of a user.
    // TODO: check if the current user is the user requesting the resource (ACL)
    if(req.url.split("/").length > 4){
        var lastPathElement = req.params.ics_id;
        if(lastPathElement.indexOf('.ics', lastPathElement.length - '.ics'.length) !== -1 ){
            isRoot = false;
        }
    }

    if(isRoot === true){
        var calendarId = req.params.calendar_id;

        CAL.find({ where: {pkey: calendarId} }).then(function(cal){
            if(!cal){
                log.warn('err: could not find calendar');
            }else{
                cal.destroy().then(function(){
                    log.debug('calendar deleted');
                });
            }

            res.status(204).end();
        });
    }else{
        var ics_id = request.getFilenameFromPath(true);

        ICS.find( { where: {pkey: ics_id}}).then(function(ics){
            if(ics === null){
                log.warn('err: could not find ics');
            }else{
                ics.destroy().then(function(){
                    log.debug('ics deleted');
                });
            }

            res.status(204).end();
        });
    }

    
}

function handleMove(req,res,next){
    log.debug("calendar.move called");

    helper.setStandardHeaders(request);

    var ics_id = req.params.ics_id.split('.')[0];
    var calendar_id = req.params.calendar_id;

    var destination = "";

    var headers = req.headers;

    for(var header in headers){
        if(header === "destination"){
            destination = req.headers[header];
        }
    }

    if(destination.length > 0){
        var aURL = destination.split("/");
        var newCal = aURL[aURL.length - 2];

        ICS.find({ where: {pkey: ics_id} }).then(function(ics){
            if(ics === null){
                log.warn('ics not found');
            }else{
                ics.calendarId = newCal;
                ics.save().then(function()
                {
                    log.warn('ics updated');
                });
            }
        });
    }

    res.status(201).end();
}


