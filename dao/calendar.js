import { USER,ICS,CAL } from './db'
import log from '../utils/log'
import helper from '../utils/caldavHelper'
import xml from 'libxmljs'
import { mountedPath } from '../conf/config';

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

// caldav client will call propfind to get all/specific calendar and ics response which format is XML-based
// statusCode must be 207, otherwise it will be rejected in some clients
async function handlePropfind(req, res, next){
    log.debug("calendar.propfind called");

    // set status code and standrad head
    helper.setStandardHeaders(res);
    helper.setDAVHeaders(res);
    res.writeHead(207);
    res.write(helper.getXMLHead());

    let response = "";

    let body = req.rawBody;

    // parse the request XML using XPATH
    // Notice:  libxmljs requires node-gyp, which does not work perfect in Windows
    //          In this case ,you can use *unix or linux subsystems for windows 10 
    let xmlDoc = xml.parseXml(body);
    let node = xmlDoc.get('/A:propfind/A:prop', {   A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });
    let childs = node.childNodes();

    let username = res.locals.username;
    let calendar_id = res.locals.calendar_id;
    let ics_id = res.locals.ics_id;


    // if last element === username, then get all calendar info of user, 
    // otherwise only from that specific calendar
    let isRoot = true;

    log.warn(`url: ${req.url}`);

    // if URL element size === 1, this is a call for the user.
    if(req.url.split("/").length > 1){
        isRoot = false;
    }else if(req.url === "/"){
        // never reach here. 
        // Mozilla lightning send the same request no matter what the url is
        // So we need to make sure there is a calendar. If not, create it 
        response += "<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">";

        let len = childs.length;
        for (let i=0; i < len; ++i){
            let child = childs[i];
            let name = child.name();
            switch(name){
                case 'calendar-free-busy-set':
                    response += "<response><href>/</href></response>";
                    break;

                case 'current-user-principal':
                    response += "<response><href>/</href>";
                    response += "<propstat><prop><current-user-principal><href>/p/" + username + "/</href></current-user-principal></prop>";
                    response += "<status>HTTP/1.1 200 OK</status>";
                    response += "</propstat>";
                    response += "</response>";
                    break;

                case 'principal-collection-set':
                    response += "<principal-collection-set><href>/p/</href></principal-collection-set>";
                    break;
                
                default:
                    log.warn('Cal-Propfind 0: not handled: '+name);
                    break;
            }
        }

        response += "</multistatus>";
        res.write(response);
        res.end();
        log.debug(`0response`)
        return;
    }

    if(isRoot === true){
        log.debug('isRoot: true');
        let nodeChecksum = xmlDoc.get('/A:propfind/A:prop/C:checksum-versions', {   A: 'DAV:',
            B: "urn:ietf:params:xml:ns:caldav",
            C: 'http://calendarserver.org/ns/',
            D: "http://apple.com/ns/ical/",
            E: "http://me.com/_namespace/"
        });

        if(nodeChecksum !== undefined){
            // request has checksum-versions, so just response to it with the calendar url
            response += "<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">";
            response += "<response><href>" + mountedPath.calDavPath + "/"+ username+"/" + calendar_id+"/" + "</href></response>";
            response += "</multistatus>";
            res.write(response);
            log.debug(`1response:`)
            res.end();
        }else{
            // request does not have checksum-versions
            // first get the default calendar of the user
            // then add info for all further known calendars of same user
            response += "<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">";
            

            let query = { where: { owner: username}, order: [['order', 'ASC']] };

            let result = await CAL.findAndCountAll(query);

            if(typeof req.params.calendar_id != "undefined"){
                // if calendar_id is specific, response the calendar
                let shouldOnlyGetDefaultCalendar = true;
                response += getResponseFromAllCalendars(req,res,next,result,childs,shouldOnlyGetDefaultCalendar);
            }else{
                // if calendar_id not specific, then response all known calendars 
                let shouldOnlyGetDefaultCalendar = false;
                response += getResponseFromAllCalendars(req,res,next,result,childs,shouldOnlyGetDefaultCalendar);
            }

            // TO-DO:
            // response += returnOutbox(req, res, next);
            // response += returnNotifications(req, res, next);

            response += "</multistatus>";
            res.write(response);
            log.debug(`2response`)
            res.end();
        }
    }else{
        log.debug('isRoot: false');

        if(calendar_id === "notifications"){
            // calendar_id is notifications
            // just reply with the default calendar url
            res.write("<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">");
            res.write("<response><href>" + mountedPath.calDavPath + "/"+ username+"/"+calendar_id+"/" + "</href>");
            res.write("</response>");
            res.write("</multistatus>");
            res.end();

        }else if(calendar_id === "outbox"){

            response += returnOutbox(req,res,next);
            res.write(response);
            res.end();
            
        }else{
            // the request url provide username and calendar_id 
            // Find the calendar first
            let cal = await CAL.find({ where: {pkey: calendar_id} });
            
            // If the calendar with same calendar_id not exists, give it
            if(!cal){
                log.warn('Calendar not found, wait to create');
                    
                log.debug(req.params);

                // default timezone.
                let timezone ="Asia/shanghai";

                let defaults = {
                    owner: username,
                    timezone: timezone,
                    order: 'order',
                    free_busy_set: "YES",
                    supported_cal_component: "VEVENT",
                    colour: "#0E61B9FF",
                    displayname: calendar_id,
                };

                let [cal,created] = await CAL.findOrCreate({ where: {pkey: calendar_id}, defaults: defaults });

                if(created){
                    log.debug('Created CAL: ' + JSON.stringify(cal, null, 4));
                }else{
                    log.debug('Loaded CAL: ' + JSON.stringify(cal, null, 4));
                }

                await cal.save();

                response += "<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">";
                // then add info for all further known calendars of same user
                let query = { where: {owner: username}, order: [['order', 'ASC']] };

                let result = await CAL.findAndCountAll(query);

                if(typeof req.params.calendar_id != "undefined"){
                    // if calendar_id is specific, response the calendar
                    let shouldOnlyGetDefaultCalendar = true;
                    response += getResponseFromAllCalendars(req,res,next,result,childs,shouldOnlyGetDefaultCalendar);
                }else{
                    // if calendar_id not specific, then response all known calendars 
                    let shouldOnlyGetDefaultCalendar = false;
                    response += getResponseFromAllCalendars(req,res,next,result,childs,shouldOnlyGetDefaultCalendar);
                }

                // response += returnOutbox(req, res, next);
                // response += returnNotifications(req, res, next);

                response += "</multistatus>";
                res.write(response);
                log.error(`3response`)
                res.end();

        

            }else{
                response += "<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">";

                // Add info for all further known calendars of same user
                let query = { where: {owner: username}, order: [['order', 'ASC']] };

                let result = await CAL.findAndCountAll(query);

                if(typeof req.params.calendar_id != "undefined"){
                    // if calendar_id is specific, response the calendar
                    let shouldOnlyGetDefaultCalendar = true;
                    response += getResponseFromAllCalendars(req,res,next,result,childs,shouldOnlyGetDefaultCalendar);
                }else{
                    // if calendar_id not specific, then response all known calendars 
                    let shouldOnlyGetDefaultCalendar = false;
                    response += getResponseFromAllCalendars(req,res,next,result,childs,shouldOnlyGetDefaultCalendar);
                }

                // Notice:   
                //      should return all ics response for Mozilla lightning
                //      because Mozilla lightning needs the response ics url.
                //      while some caldav client(SOL Caldav) will initiatively 
                //      send a REPORT request to get ics url.
                // Warning:
                //      Caldav client won't delete those who have been deleted on the server.
                //      Therefore, if something is removed on the server, it can't be synced by 
                //      caldav client except you remove the calendar and then add as a new one
                let resultICS = await ICS.findAndCountAll({ where: {calendarId: calendar_id}});

                log.debug(calendar_id);
                if(!resultICS){
                    log.debug('not found ics');
                }else{
                    for(let i=0,len=resultICS.count;i<len;i++){
                        let ics = resultICS.rows[i];
                        log.debug(`found ics:${ics.pkey}`);
                        let isRoot = false;
                        let returnedCalendar = returnICSCalendar(req, res, next, ics, childs);
                        response += returnedCalendar;
                    }    
                }

                // response += returnOutbox(req, res, next);
                // response += returnNotifications(req, res, next);

                response += "</multistatus>";
                res.write(response);
                log.error(`4response`)
                res.end();
            }
        }
    }
}

function getResponseFromAllCalendars(req,res,next,calendars,childs,shouldOnlyGetDefaultCalendar){
    log.debug(`shouldOnlyGetDefaultCalendar: ${shouldOnlyGetDefaultCalendar}`);
    let response = "";
    let calendar_id = res.locals.calendar_id;
    for (let i=0; i < calendars.count; ++i){
        let calendar = calendars.rows[i];
        if(calendar.pkey == calendar_id){
            log.debug('return root calendar')
            let isRoot = true;
            let returnedCalendar = returnCalendar(req, res, next, calendar, childs, isRoot);
            response += returnedCalendar;
        }else{
            let isRoot = false;
            if(shouldOnlyGetDefaultCalendar == false){
                let returnedCalendar = returnCalendar(req, res, next, calendar, childs, isRoot);
                response += returnedCalendar;
            }
        }
    }
    return response;
}

function returnPropfindElements(req, res, next, calendar, childs, isRoot, tempArr = []){
    let response = "";

    if(typeof isRoot == "undefined"){
        isRoot = false;
    }

    let username = res.locals.username;

    let token = calendar.synctoken;

    let len = childs.length;
    let date = Date.parse(calendar.updatedAt);

    for (let i=0; i < len; ++i){
        let child = childs[i];
        let name = child.name();
        switch(name){
            case 'add-member':
                response += "";
                break;

            case 'allowed-sharing-modes':
                response += "<CS:allowed-sharing-modes><CS:can-be-shared/><CS:can-be-published/></CS:allowed-sharing-modes>";
                break;

            case 'autoprovisioned':
                response += "";
                break;

            case 'bulk-requests':
                response += "";
                break;

            case 'calendar-home-set':
                response += "<C:calendar-home-set><href>" + mountedPath.calDavPath + "/" + res.locals.username + "/" + "</href></C:calendar-home-set>"
                break;

            case 'calendar-color':
                response += "<xical:calendar-color xmlns:xical=\"http://apple.com/ns/ical/\">" + calendar.colour + "</xical:calendar-color>";
                break;

            case 'calendar-description':
                response += "";
                break;

            case 'calendar-free-busy-set':
                response += "";
                break;

            case 'calendar-order':
                response += "<xical:calendar-order xmlns:xical=\"http://apple.com/ns/ical/\">" + calendar.order + "</xical:calendar-order>";
                break;

            case 'calendar-timezone':
                let timezone = calendar.timezone;
                timezone = timezone.replace(/\r\n|\r|\n/g,'&#13;\r\n');

                response += "<C:calendar-timezone>" + timezone + "</C:calendar-timezone>";
                break;

            case 'current-user-privilege-set':
                response += getCurrentUserPrivilegeSet();
                break;

            case 'default-alarm-vevent-date':
                response += "";
                break;

            case 'default-alarm-vevent-datetime':
                response += "";
                break;

            case 'displayname':
                response += "<displayname>" + calendar.displayname + "</displayname>";
                break;

            case 'language-code':
                response += "";
                break;

            case 'location-code':
                response += "";
                break;

            case 'owner':
                response += "<owner>/p/" + username +"/</owner>";
                break;

            case 'pre-publish-url':
                response += "<CS:pre-publish-url><href>https://127.0.0.1:9876" + mountedPath.calDavPath+"/" + username + "/" + calendar.pkey + "</href></CS:pre-publish-url>";
                break;

            case 'publish-url':
                response += "";
                break;

            case 'push-transports':
                response += "";
                break;

            case 'pushkey':
                response += "";
                break;

            case 'quota-available-bytes':
                response += "";
                break;

            case 'quota-used-bytes':
                response += "";
                break;

            case 'refreshrate':
                response += "";
                break;

            case 'resource-id':
                response += "";
                break;

            case 'resourcetype':
                response += "<resourcetype><C:calendar/><collection/></resourcetype>";
                break;

            case 'schedule-calendar-transp':
                response += "<C:schedule-calendar-transp><C:opaque/></C:schedule-calendar-transp>";
                break;

            case 'schedule-default-calendar-URL':
                response += "";
                break;

            case 'source':
                response += "";
                break;

            case 'subscribed-strip-alarms':
                response += "";
                break;

            case 'subscribed-strip-attachments':
                response += "";
                break;

            case 'subscribed-strip-todos':
                response += "";
                break;

            case 'supported-calendar-component-set':
                response += "<C:supported-calendar-component-set><C:comp name=\"VTODO\"/><C:comp name=\"VEVENT\"/><C:comp name=\"VJOURNAL\"/></C:supported-calendar-component-set>";
                break;

            case 'supported-calendar-component-sets':
                response += "<C:supported-calendar-component-set><C:comp name=\"VEVENT\"/></C:supported-calendar-component-set>";
                break;

            case 'supported-report-set':
                response += getSupportedReportSet(isRoot);
                break;

            case 'getctag':
                response += "<CS:getctag>\"" + calendar.pkey +"-"+ Number(date) + "\"</CS:getctag>";
                // response += "<CS:getctag>\"d41d8cd98f00b204e9800998ecf8427e\"</CS:getctag>";
                break;

            case 'getetag':
                response += "<getetag>\"" + calendar.pkey +"-"+Number(date) + "\"</getetag>";
                break;

            case 'checksum-versions':
                // no response?
                break;

            case 'sync-token':
                response += "<sync-token>http://swordlord.com/ns/sync/" + token + "</sync-token>";
                break;

            case 'acl':
                response += getACL(req,res,next);
                break;

            case 'getcontenttype':
                //response += "<getcontenttype>text/calendar;charset=utf-8</getcontenttype>";
                break;
            
            case 'principal-collection-set':
                response += "<principal-collection-set>/p/</principal-collection-set>";
                break;

            case 'calendar-free-busy-set':
                response += "<calendar-free-busy-set>/</calendar-free-busy-set>";
                break;

            case 'current-user-principal':
                response += "<current-user-principal>/p/" + username + "/</current-user-principal>";
                break;

            default:
                if(name != 'text') {
                    log.warn("CAL-PF: not handled: " + name);
                    if(typeof tempArr != 'undefined'){
                        tempArr.push(name);
                    }
                }
                break;
        }
    }

    return response;
}

function returnPropfindICSElements(req, res, next, ics, childs, tempArr = []){
    let response = "";

    let len = childs.length;
    let date = Date.parse(ics.updatedAt);

    for (let i=0; i < len; ++i){
        let child = childs[i];
        let name = child.name();
        switch(name){
            case 'getetag':
                response += "<getetag>\"" + ics.pkey + "-" + Number(date) + "\"</getetag>";
                break;

            case 'getcontenttype':
                response += "<getcontenttype>text/calendar; component=VEVENT</getcontenttype>";
                break;

            case 'resourcetype':
                response += "<C:calendar-data>" + ics.content + "</C:calendar-data>";
                break;

            default:
                if(name != 'text') {
                    log.warn("CAL-PF: not handled: " + name);
                    if(typeof tempArr != 'undefined'){
                        tempArr.push(name);
                    }
                }
                break;
        }
    }

    return response;
}

function returnICSCalendar(req, res, next, ics, childs){
    let response = "";
    let username = res.locals.username;

    response += "	<response>";
    response += "		<href>" + mountedPath.calDavPath+"/" + username + "/" + ics.calendarId + "/" + ics.pkey + ".ics</href>";
    response += "		<propstat>";
    response += "			<prop>";

    let tempArr = [];

    let returned = returnPropfindICSElements(req, res, next, ics, childs, tempArr);
    response += returned;

    response += "			</prop>";
    response += "			<status>HTTP/1.1 200 OK</status>";
    response += "		</propstat>";
    for(let j=0;j<tempArr.length;j++){
        response +=`<propstat>`
        response +=`<prop>`
        response +=`<${tempArr[j]}/>`
        response +=`</prop>`
        response +=`<status>HTTP/1.1 404 Not Found</status>`
        response +=`</propstat>`
    }
    response += "	</response>";

    return response;
}

function returnCalendar(req, res, next, calendar, childs, isRoot ){
    let response = "";
    let username = res.locals.username;

    if(typeof isRoot == "undefined"){
        isRoot = false;
    }

    response += "	<response>";
    response += "		<href>" + mountedPath.calDavPath+"/" + username + "/" + calendar.pkey + "/</href>";
    response += "		<propstat>";
    response += "			<prop>";

    let tempArr = [];

    let returned = returnPropfindElements(req, res, next, calendar, childs, isRoot, tempArr);
    response += returned;

    response += "			</prop>";
    response += "			<status>HTTP/1.1 200 OK</status>";
    response += "		</propstat>";
    if(isRoot == true){
        for(let j=0;j<tempArr.length;j++){
            response +=`<propstat>`
            response +=`<prop>`
            response +=`<${tempArr[j]}/>`
            response +=`</prop>`
            response +=`<status>HTTP/1.1 404 Not Found</status>`
            response +=`</propstat>`
        }
    }
    response += "	</response>";

    return response;
}

function getSupportedReportSet(isRoot){
    let response = "";

    response += "<supported-report-set>";

    if(!isRoot){
        response += "<supported-report><report>calendar-multiget</report></supported-report>";
        response += "<supported-report><report>calendar-query</report></supported-report>";
        response += "<supported-report><report>free-busy-query</report></supported-report>";
    }

    response += "<supported-report><report>principal-property-search</report></supported-report>";
    response += "<supported-report><report>sync-collection</report></supported-report>";
    response += "<supported-report><report>expand-property</report></supported-report>";
    response += "<supported-report><report>principal-search-property-set</report></supported-report>";
    response += "</supported-report-set>";

    return response;
}

function getCurrentUserPrivilegeSet(){
    let response = "";

    response += "<current-user-privilege-set>";
    response += "<privilege xmlns=\"DAV:\"><C:read-free-busy/></privilege>";
    response += "<privilege xmlns=\"DAV:\"><write/></privilege>";
    response += "<privilege xmlns=\"DAV:\"><write-acl/></privilege>";
    response += "<privilege xmlns=\"DAV:\"><write-content/></privilege>";
    response += "<privilege xmlns=\"DAV:\"><write-properties/></privilege>";
    response += "<privilege xmlns=\"DAV:\"><bind/></privilege>";
    response += "<privilege xmlns=\"DAV:\"><unbind/></privilege>";
    response += "<privilege xmlns=\"DAV:\"><unlock/></privilege>";
    response += "<privilege xmlns=\"DAV:\"><read/></privilege>";
    response += "<privilege xmlns=\"DAV:\"><read-acl/></privilege>";
    response += "<privilege xmlns=\"DAV:\"><read-current-user-privilege-set/></privilege>";
    response += "</current-user-privilege-set>";

    return response;
}

function getACL(req, res, next){
    let username = res.locals.username;
    let response = "";

    response += "<acl>";
    response += "    <ace>";
    response += "        <principal><href>/p/" + username + "</href></principal>";
    response += "        <grant><privilege><read/></privilege></grant>";
    response += "        <protected/>";
    response += "    </ace>";

    response += "    <ace>";
    response += "        <principal><href>/p/" + username + "</href></principal>";
    response += "        <grant><privilege><write/></privilege></grant>";
    response += "        <protected/>";
    response += "    </ace>";

    response += "    <ace>";
    response += "        <principal><href>/p/" + username + "/calendar-proxy-write/</href></principal>";
    response += "        <grant><privilege><read/></privilege></grant>";
    response += "        <protected/>";
    response += "    </ace>";

    response += "    <ace>";
    response += "        <principal><href>/p/" + username + "/calendar-proxy-write/</href></principal>";
    response += "        <grant><privilege><write/></privilege></grant>";
    response += "        <protected/>";
    response += "    </ace>";

    response += "    <ace>";
    response += "        <principal><href>/p/" + username + "/calendar-proxy-read/</href></principal>";
    response += "        <grant><privilege><read/></privilege></grant>";
    response += "        <protected/>";
    response += "    </ace>";

    response += "    <ace>";
    response += "        <principal><authenticated/></principal>";
    response += "        <grant><privilege><C:read-free-busy/></privilege></grant>";
    response += "        <protected/>";
    response += "    </ace>";

    response += "    <ace>";
    response += "        <principal><href>/p/system/admins/</href></principal>";
    response += "        <grant><privilege><all/></privilege></grant>";
    response += "        <protected/>";
    response += "    </ace>";

    return response;
}

// Warning:
//      MKCALENDAR has not be used since express do not support MKCALENDAR verb.
//      moreover,node.js less than 4.X does not support MKCALENDAR,too.
//      Therefore, we decide to make calendar if not exists in PROPFIND handler to skip MKCALENDAR
async function handleMkcalendar(req, res, next){
    log.debug("calendar.makeCalendar called");

    let response = "";

    helper.setStandardHeaders(res);

    let body = req.rawBody;
    let xmlDoc = xml.parseXml(body);

    let node = xmlDoc.get('/B:mkcalendar/A:set/A:prop', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });

    let childs = node.childNodes();

    let timezone,
    order,
    free_busy_set,
    supported_cal_component,
    colour,
    displayname;

    let len = childs.length;
    if(len > 0){
        for (let i=0; i < len; ++i){
            let child = childs[i];
            let name = child.name();
            switch(name){
                case 'calendar-color':
                    colour = child.text();
                    break;

                case 'calendar-free-busy-set':
                    free_busy_set = "YES";
                    break;

                case 'displayname':
                    displayname = child.text();
                    break;

                case 'calendar-order':
                    order = child.text();
                    break;

                case 'supported-calendar-component-set':
                    supported_cal_component = "VEVENT";
                    break;

                case 'calendar-timezone':
                    timezone = child.text();
                    break;

                default:
                    if(name != 'text') 
                        log.warn("CAL-Mkcalendar: not handled: " + name);
                    break;
            }
        }

        if(colour === undefined || colour.length === 0) { 
            colour = "#0E61B9FF"; 
        }

        let filename = res.locals.ics_id;

        let defaults = {
            owner: res.locals.username,
            timezone: timezone,
            order: order,
            free_busy_set: free_busy_set,
            supported_cal_component: supported_cal_component,
            colour: colour,
            displayname: displayname
        };

        let [cal,created] = await CAL.findOrCreate({ where: {pkey: filename}, defaults: defaults });

        if(created){
            log.debug('Created CAL: ' + JSON.stringify(cal, null, 4));
        }else{
            log.debug('Loaded CAL: ' + JSON.stringify(cal, null, 4));
        }

        cal.save().then(function(){
            log.warn('cal saved');
        });

        res.writeHead(201);
        res.write(response);
        res.end();
    }else{
        res.writeHead(500);
        res.write(response);
        res.end();
    }
}

async function handleReport(req, res, next){
    log.debug("calendar.report called");

    helper.setStandardHeaders(res);
    res.writeHead(207);
    res.write(helper.getXMLHead());

    let body = req.rawBody;
    let xmlDoc = xml.parseXml(body);

    let rootNode = xmlDoc.root();

    let name = rootNode.name();
    switch(name){
        case 'sync-collection':
            await handleReportSyncCollection(req,res,next);
            break;

        case 'calendar-multiget':
            await handleReportCalendarMultiget(req,res,next);
            break;

        case 'calendar-query':
            await handleReportCalendarQuery(req,res,next);
            break;

        default:
            if(name != 'text') 
                log.warn("CAL-Report: not handled: " + name);
            break;
    }
}

async function handleReportCalendarQuery(req, res, next){

    let calendarId = res.locals.calendar_id;

    let cal = await CAL.find({ where: {pkey: calendarId} } );
    
    let result = await ICS.findAndCountAll({ where: {calendarId: calendarId}});
    let body = req.rawBody;
    let xmlDoc = xml.parseXml(body);

    let nodeProp = xmlDoc.get('/B:calendar-query/A:prop', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });

    let nodeFilter = xmlDoc.get('/B:filter', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });

    let response = "";

    let nodeProps = nodeProp.childNodes();
    let len = nodeProps.length;

    for (let j=0; j < result.count; ++j){
        let ics = result.rows[j];

        response += "<response><href>" + mountedPath.calDavPath +"/"+ res.locals.username+"/";
        response += res.locals.calendar_id+"/" + ics.pkey +".ics" + "</href>";
        response += "<propstat>";
        response += "<prop>";

        let date = Date.parse(ics.updatedAt);

        for (let i=0; i < len; ++i){
            let child = nodeProps[i];
            let name = child.name();
            switch(name){
                case 'getetag':
                    response += "<getetag>\"" + ics.pkey + "-"+ Number(date) + "\"</getetag>";
                    break;

                case 'getcontenttype':
                    response += "<getcontenttype>text/calendar; charset=utf-8; component=" + cal.supported_cal_component + "</getcontenttype>";
                    break;

                case 'calendar-data':
                    response += "<c:calendar-data>" + ics.content + "</c:calendar-data>";
                    break;

                default:
                    if(name != 'text') 
                        log.warn("CAL-Report: not handled: " + name);
                    break;
            }
        }

        response += "</prop><status>HTTP/1.1 200 OK</status></propstat>";
        response += "</response>";
    }


    res.write("<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\" xmlns:ical=\"http://apple.com/ns/ical/\">\r\n");

    res.write(response);
    res.write("</multistatus>");
    res.end();
}

async function handleReportSyncCollection(req, res, next){
    let body = req.rawBody;
    let xmlDoc = xml.parseXml(body);

    let node = xmlDoc.get('/A:sync-collection', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });

    if(node != undefined){
        let calendarId = res.locals.calendar_id;

        let cal = await CAL.find({ where: {pkey: calendarId} } );

        let result = await ICS.findAndCountAll({ where: {calendarId: calendarId}});
        let response = "";

        for (let j=0; j < result.count; ++j){
            let ics = result.rows[j];

            let childs = node.childNodes();

            let len = childs.length;
            for (let i=0; i < len; ++i){
                let child = childs[i];
                let name = child.name();
                switch(name){
                    case 'sync-token':
                        break;

                    case 'prop':
                        response += handleReportCalendarProp(req, res, next, child, cal, ics);
                        break;

                    default:
                        if(name != 'text') 
                            log.warn("CAL-Report: not handled: " + name);
                        break;
                }
            }

        }

        log.debug(`response : ${response}`);

        res.write("<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\" xmlns:ical=\"http://apple.com/ns/ical/\">\r\n");
        res.write(response);
        res.write("<sync-token>http://swordlord.org/ns/sync/" + cal.synctoken + "</sync-token>");
        res.write("</multistatus>");

        log.debug(`end report`)
        res.status(200).end();
    }
}

function handleReportCalendarProp(req, res, next, node, cal, ics){
    let response = "";

    response += "<response>";
    response += "<href>" + mountedPath.calDavPath+"/" + res.locals.username +"/"+res.locals.calendar_id + "/</href>";
    response += "<propstat><prop>";

    let childs = node.childNodes();

    let date = Date.parse(ics.updatedAt);

    let len = childs.length;
    for (let i=0; i < len; ++i){
        let child = childs[i];
        let name = child.name();
        switch(name){
            case 'getetag':
                response += "<getetag>\"" + ics.pkey + "-" + Number(date) + "\"</getetag>";
                break;

            case 'getcontenttype':
                response += "<getcontenttype>text/calendar; charset=utf-8; component=" + cal.supported_cal_component + "</getcontenttype>";
                break;

            default:
                if(name != 'text') 
                    log.warn("CAL-Report: not handled: " + name);
                break;
        }
    }

    response += "</prop>";
    response += "<status>HTTP/1.1 200 OK</status>";
    response += "</propstat>";
    response += "</response>";

    return response;
}

async function handleReportCalendarMultiget(req,res,next){
    let body = req.rawBody;
    let xmlDoc = xml.parseXml(body);

    let node = xmlDoc.get('/B:calendar-multiget', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });

    if(node != undefined){
        let childs = node.childNodes();

        let arrHrefs = [];

        let len = childs.length;
        for (let i=0; i < len; ++i){
            let child = childs[i];
            let name = child.name();
            switch(name){
                case 'prop': // TODO: theoretically we should first get the parameters ordered by the client, lets do so later :)
                    break;

                case 'href':
                    arrHrefs.push(parseHrefToIcsId(child.text()));
                    break;

                default:
                    if(name != 'text') 
                        log.warn("P-R: not handled: " + name);
                    break;
            }
        }
        await handleReportHrefs(req, res, next, arrHrefs);
    }
}

function parseHrefToIcsId(href){
    let e = href.split("/");
    let id = e[e.length - 1];

    return id.split('.')[0];
}

async function handleReportHrefs(req, res, next, arrIcsIds){
    arrIcsIds = arrIcsIds.map(item=>decodeURIComponent(item));
    log.debug(`ics ids wait to found: ${arrIcsIds}`);
    let result = await ICS.findAndCountAll( { where: {pkey: arrIcsIds}});

    let response = "";
    log.debug(`found ics total:${result.count}`);

    for (let i=0; i < result.count; ++i){
        let ics = result.rows[i];

        let date = Date.parse(ics.updatedAt);

        response += "<response>";
        response += "<href>" + mountedPath.calDavPath + "/"+ res.locals.username+"/"+res.locals.calendar_id+"/" + ics.pkey + ".ics</href>";
        response += "<propstat><prop>";
        response += "<getetag>\"" + Number(date) + "\"</getetag>";
        response += "<C:calendar-data>" + ics.content + "</C:calendar-data>";
        response += "</prop>";
        response += "<status>HTTP/1.1 200 OK</status></propstat>";
        // response += "<propstat><prop>";
        // response += "<CS:created-by/><CS:updated-by/>";
        // response += "</prop><status>HTTP/1.1 404 Not Found</status></propstat>";
        response += "</response>";
    }

    res.write("<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\">\r\n");
    res.write(response);
    res.write("</multistatus>\r\n");
    res.end();
}

async function handleProppatch(req,res,next){
    log.debug("calendar.proppatch called");

    helper.setStandardHeaders(res);

    res.write(helper.getXMLHead());

    let body = req.rawBody;
    let xmlDoc = xml.parseXml(body);

    let node = xmlDoc.get('/A:propertyupdate/A:set/A:prop', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });
    let childs = node.childNodes();

    let isRoot = true;

    // if URL element size === 3, this is a call for the root URL of a user.
    // TODO:

    if(req.url.split("/").length > 3){
        let lastPathElement = req.params.ics_id;
        if(helper.stringEndsWith(lastPathElement,'.ics')){
            isRoot = false;
        }
    }

    let response = "";

    if(isRoot){
        let calendarId = res.locals.calendar_id;
        let cal = await CAL.find({ where: {pkey: calendarId} });
        if(!cal){
            log.warn('Calendar not found');

            let len = childs.length;
            for (let i=0; i < len; ++i){
                let child = childs[i];
                let name = child.name();
                switch(name){
                    case 'default-alarm-vevent-date':
                        response += "<C:default-alarm-vevent-date/>";
                        log.info("proppatch default-alarm-vevent-date not handled yet");
                        break;

                    case 'default-alarm-vevent-datetime':
                        response += "<C:default-alarm-vevent-datetime/>";
                        log.info("proppatch default-alarm-vevent-datetime not handled yet");
                        break;

                    default:
                        if(name != 'text') 
                            log.warn("Cal-proppatch: not handled: " + name);
                        break;
                }
            }

            res.write("<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\" xmlns:ical=\"http://apple.com/ns/ical/\">\r\n");
            res.write("	<response>\r\n");
            res.write("		<href>" + mountedPath.calDavPath+"/" + res.locals.username+"/" + res.locals.calendar_id + "/</href>\r\n");
            res.write("		<propstat>\r\n");
            res.write("			<prop>\r\n");
            res.write(response);
            res.write("			</prop>\r\n");
            res.write("			<status>HTTP/1.1 403 Forbidden</status>\r\n");
            res.write("		</propstat>\r\n");
            res.write("	</response>\r\n");
            res.write("</multistatus>\r\n");
        }else{
            let len = childs.length;
            for (let i=0; i < len; ++i){
                let child = childs[i];
                let name = child.name();
                switch(name){
                    case 'default-alarm-vevent-date':
                        response += "<C:default-alarm-vevent-date/>";
                        log.info("proppatch default-alarm-vevent-date not handled yet");
                        break;

                    case 'default-alarm-vevent-datetime':
                        response += "<C:default-alarm-vevent-datetime/>";
                        log.info("proppatch default-alarm-vevent-datetime not handled yet");
                        break;

                    case 'displayname':
                        response += "<C:displayname/>";
                        cal.displayname = child.text();
                        break;

                    case 'calendar-timezone':
                        response += "<C:calendar-timezone/>";
                        cal.timezone = child.text();
                        break;

                    case 'calendar-color':
                        response += "<ical:calendar-color/>";
                        cal.colour = child.text();
                        break;

                    case 'calendar-order':
                        response += "<ical:calendar-order/>";
                        cal.order = child.text();
                        break;

                    default:
                        if(name != 'text') 
                            log.warn("CAL-proppatch: not handled: " + name);
                        break;
                }
            }

            await cal.save();

            log.warn('cal saved');

            res.write("<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\" xmlns:ical=\"http://apple.com/ns/ical/\">\r\n");
            res.write("	<response>\r\n");
            res.write("		<href>" + "/"+ res.locals.username+"/"+res.locals.calendar_id+"/" + "</href>\r\n");
            res.write("		<propstat>\r\n");
            res.write("			<prop>\r\n");
            res.write(response);
            res.write("			</prop>\r\n");
            res.write("			<status>HTTP/1.1 200 OK</status>\r\n");
            res.write("		</propstat>\r\n");
            res.write("	</response>\r\n");
            res.write("</multistatus>\r\n");
        }

        res.status(200).end();

    }

    
}

function returnOutbox(req,res,next){
    let response = "";

    let username = res.locals.username

    response += "<response>";
    response += "   <href>" + mountedPath.calDavPath+"/" + username + "/outbox/</href>";
    response += "    <propstat>";
    response += "        <prop>";
    response += "            <current-user-privilege-set>";
    response += "               <privilege xmlns=\"DAV:\">";
    response += "                   <read/>";
    response += "               </privilege>";
    response += "               <privilege xmlns=\"DAV:\">";
    response += "                   <read-acl/>";
    response += "               </privilege>";
    response += "               <privilege xmlns=\"DAV:\">";
    response += "                   <read-current-user-privilege-set/>";
    response += "               </privilege>";
    response += "               <privilege xmlns=\"DAV:\">";
    response += "                   <schedule-post-vevent xmlns=\"urn:ietf:params:xml:ns:caldav\"/>";
    response += "               </privilege>";
    response += "               <privilege xmlns=\"DAV:\">";
    response += "                   <schedule-query-freebusy xmlns=\"urn:ietf:params:xml:ns:caldav\"/>";
    response += "               </privilege>";
    response += "           </current-user-privilege-set>";
    response += "           <owner>";
    response += "               <href>/p/" + username + "/</href>";
    response += "           </owner>";
    response += "           <resourcetype>";
    response += "              <collection/>";
    response += "               <C:schedule-outbox/>";
    response += "           </resourcetype>";
    response += "           <supported-report-set>";
    response += "              <supported-report>";
    response += "                   <report>";
    response += "                       <expand-property/>";
    response += "                   </report>";
    response += "               </supported-report>";
    response += "               <supported-report>";
    response += "                   <report>";
    response += "                       <principal-property-search/>";
    response += "                   </report>";
    response += "               </supported-report>";
    response += "               <supported-report>";
    response += "                    <report>";
    response += "                       <principal-search-property-set/>";
    response += "                   </report>";
    response += "               </supported-report>";
    response += "            </supported-report-set>";
    response += "       </prop>";
    response += "       <status>HTTP/1.1 200 OK</status>";
    response += "   </propstat>";
    response += "</response>";

    return response;
}

function returnNotifications(req,res,next){
    let response = "";

    let username = res.locals.username;

    response += "<response>";
    response += "<href>" + mountedPath.calDavPath + "/" + username + "/notifications/</href>";
    response += "<propstat>";
    response += "    <prop>";
    response += "        <current-user-privilege-set>";
    response += "            <privilege xmlns=\"DAV:\">";
    response += "                <write/>";
    response += "           </privilege>";
    response += "           <privilege xmlns=\"DAV:\">";
    response += "               <write-acl/>";
    response += "           </privilege>";
    response += "           <privilege xmlns=\"DAV:\">";
    response += "               <write-properties/>";
    response += "          </privilege>";
    response += "           <privilege xmlns=\"DAV:\">";
    response += "               <write-content/>";
    response += "           </privilege>";
    response += "            <privilege xmlns=\"DAV:\">";
    response += "               <bind/>";
    response += "            </privilege>";
    response += "            <privilege xmlns=\"DAV:\">";
    response += "                <unbind/>";
    response += "            </privilege>";
    response += "            <privilege xmlns=\"DAV:\">";
    response += "                <unlock/>";
    response += "           </privilege>";
    response += "           <privilege xmlns=\"DAV:\">";
    response += "               <read/>";
    response += "           </privilege>";
    response += "           <privilege xmlns=\"DAV:\">";
    response += "                <read-acl/>";
    response += "           </privilege>";
    response += "           <privilege xmlns=\"DAV:\">";
    response += "               <read-current-user-privilege-set/>";
    response += "            </privilege>";
    response += "       </current-user-privilege-set>";
    response += "       <owner>";
    response += "           <href>/p/" + username + "/</href>";
    response += "       </owner>";
    response += "       <resourcetype>";
    response += "           <collection/>";
    response += "           <CS:notification/>";
    response += "       </resourcetype>";
    response += "       <supported-report-set>";
    response += "           <supported-report>";
    response += "               <report>";
    response += "                   <expand-property/>";
    response += "               </report>";
    response += "           </supported-report>";
    response += "           <supported-report>";
    response += "               <report>";
    response += "                   <principal-property-search/>";
    response += "               </report>";
    response += "           </supported-report>";
    response += "          <supported-report>";
    response += "               <report>";
    response += "                  <principal-search-property-set/>";
    response += "              </report>";
    response += "           </supported-report>";
    response += "       </supported-report-set>";
    response += "   </prop>";
    response += "<status>HTTP/1.1 200 OK</status>";
    response += "</propstat>";
    response += "</response>";

    return response;
}

// caldav client will call OPTIONS request to get the server info 
function handleOptions(req,res,next){
    log.debug("calendar.options called");

    helper.setStandardHeaders(res);
    helper.setDAVHeaders(res);

    res.status(200).end();
}

// caldav client will call PUT request to add/update VEVENT and etc
// statusCode must be 201, otherwise it will be rejected by client
async function handlePut(req,res,next){
    log.debug("calendar.put called");

    let calendar_id = res.locals.calendar_id;
    let ics_id = res.locals.ics_id;

    let defaults = {
        calendarId: calendar_id,
        content: req.rawBody,
    };

    let [ics,created] = await ICS.findOrCreate({ where: {pkey: ics_id}, defaults: defaults})

    if(created){
        log.debug('Created ICS: ' + JSON.stringify(ics, null, 4));
    }else{
        ics.content = req.rawBody;
        log.debug('Loaded ICS: ' + JSON.stringify(ics, null, 4));
    }

    helper.setStandardHeaders(res);

    let date = ics.updatedAt;
    let etag = Number(Date.parse(date));
    res.set("ETag", etag);

    res.status(201).end();

    await ics.save()
    log.info('ics updated');

    let cal = await CAL.findOne({ where: {pkey: calendar_id} });

    if(cal !== null && cal !== undefined){
        await cal.increment('synctoken', { by: 1 })
        log.info('synctoken on cal updated');
    }
}

async function handleGet(req,res,next){
    log.debug("calendar.get called");

    res.set("Content-Type", "text/calendar");

    let ics_id = res.locals.ics_id;

    let ics = await ICS.find( { where: {pkey: ics_id}});

    if(!ics){
        log.warn('calendar GET err: could not find ics');
    }else{
        log.warn('calendar GET ok')
        let content = ics.content;
        res.write(content);
    }
    
    res.status(200).end();

}

async function handleDelete(req,res,next){
    log.debug("calendar.delete called");

    res.set("Content-Type", "text/html");
    res.set("Server", "Caldav");

    let isRoot = true;

    // if URL element size === 3, this is a call for the root URL of a user.
    if(req.url.split("/").length > 3){
        let lastPathElement = req.params.ics_id;
        if(helper.stringEndsWith(lastPathElement,'.ics')){
            isRoot = false;
        }
    }

    // check if the current user is the user requesting the resource (ACL)
    if(req.user != req.params.username){
        log.warn('can not delete resources which not belongs to the user');
        res.status(400).end();
        return;
    }

    if(isRoot === true){

        let calendarId = res.locals.calendar_id;
        let cal = await CAL.find({ where: {pkey: calendarId} });
        if(!cal){
            log.warn('err: could not find calendar');
        }else{
            cal.destroy().then(function(){
                log.debug('calendar deleted');
            });
        }
        
        res.status(204).end();

    }else{

        let ics_id = res.locals.ics_id;
        let ics = await ICS.find( { where: {pkey: ics_id}});
        if(!ics){
            log.warn('err: could not find ics');
        }else{
            ics.destroy().then(function(){
                log.debug('ics deleted');
            });
        }

        res.status(204).end();
    } 
}

async function handleMove(req,res,next){
    log.debug("calendar.move called");

    helper.setStandardHeaders(res);

    let ics_id = res.locals.ics_id;
    let calendar_id = res.locals.calendar_id;
    let destination = "";

    let headers = req.headers;

    for(let header in headers){
        if(header === "destination"){
            destination = req.headers[header];
        }
    }

    // check if the current user is the user requesting the resource (ACL)
    if(req.user != req.params.username){
        log.warn('can not move resources which not belongs to the user');
        res.status(400).end();
        return;
    }

    if(destination.length > 0){

        let aURL = destination.split("/");
        let newCal = aURL[aURL.length - 2];
        newCal = newCal.split('.')[0]

        let ics = await ICS.find({ where: {pkey: ics_id} });
        if(!ics){
            log.warn('ics not found');
        }else{
            ics.calendarId = newCal;
            ics.save().then(function(){
            log.warn('ics updated');
            });
        }
    }

    res.status(201).end();
}


