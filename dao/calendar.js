import obj from './db'
import log from '../utils/log'
import helper from '../conf/caldavHelper'
import xml from 'libxmljs'

var USER = obj.USER;
var ICS = obj.ICS;
var CAL = obj.CAL;

export default {
    handlePropfind,
    handleProppatch,
    handleOptions,
    handleReport,
    handlePut,
    handleNewPut,
    handleGet,
    handleDelete,
    handleMove,
    handleMkcalendar,
}


function handlePropfind(req, res, next){
    log.debug("calendar.propfind called");

    helper.setStandardHeaders(res);
    helper.setDAVHeaders(res);

    res.write(helper.getXMLHead());

    var response = "";

    var body = req.rawBody;

    var xmlDoc = xml.parseXml(body);
    var node = xmlDoc.get('/A:propfind/A:prop', {   A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });
    var childs = node.childNodes();

    var isRoot = true;
    var username = req.params.username;
    var calendar_id = req.params.calendar_id || username;
    var ics_id = req.params.ics_id || calendar_id;

    // if last element === username, then get all calendar info of user, otherwise only from that specific calendar
    //var lastelement = request.getLastPathElement();

    // if URL element size === 4, this is a call for the root URL of a user.
    // TODO:

    if(req.url.split("/").length > 4){
        isRoot = false;
    }else if(req.url === "/"){
        response += "<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">";

        var len = childs.length;
        for (var i=0; i < len; ++i){
            var child = childs[i];
            var name = child.name();
            switch(name){
                case 'calendar-free-busy-set':
                    response += "<d:response><d:href>/</d:href></d:response>";
                    break;

                case 'current-user-principal':
                    response += "<d:response><d:href>/</d:href>";
                    response += "<d:propstat><d:prop><d:current-user-principal><d:href>/p/" + username + "/</d:href></d:current-user-principal></d:prop>";
                    response += "<d:status>HTTP/1.1 200 OK</d:status>";
                    response += "</d:propstat>";
                    response += "</d:response>";
                    break;

                case 'principal-collection-set':
                    response += "<d:principal-collection-set><d:href>/p/</d:href></d:principal-collection-set>";
                    break;
            }
        }

        response += "</d:multistatus>";
        res.write(response);
        res.status(207).end();
        return;
    }

    if(isRoot === true){
        log.error('is root true');
        var nodeChecksum = xmlDoc.get('/A:propfind/A:prop/C:checksum-versions', {   A: 'DAV:',
            B: "urn:ietf:params:xml:ns:caldav",
            C: 'http://calendarserver.org/ns/',
            D: "http://apple.com/ns/ical/",
            E: "http://me.com/_namespace/"
        });

        if(nodeChecksum !== undefined){
            response += "<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">";
            response += "<d:response><d:href>/cal" + "/"+ req.params.username+"/" + calendar_id+"/" + "</d:href></d:response>";
            response += "</d:multistatus>";
            res.write(response);
            log.error(`1response: ${response}`)
            res.status(207).end();
        }else{
            // first get the root node info
            response += "<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">";
            response += getCalendarRootNodeResponse(req, res, next, childs);

            // then add info for all further known calendars of same user
            var query = { where: {owner: username}, order: [['order', 'ASC']] };

            CAL.findAndCountAll(query).then(function(result){

                for (var i=0; i < result.count; ++i){
                    var calendar = result.rows[i];
                    response += returnCalendar(req, res, next, calendar, childs);
                }

                response += returnOutbox(req, res, next);
                response += returnNotifications(req, res, next);

                response += "</d:multistatus>";
                res.write(response);
                log.error(`2response: ${response}`)
                res.status(207).end();
            });
        }
    }else{
        log.error('is root false');
        // otherwise get that specific calendar information

        if(calendar_id === "notifications"){
           /*response += returnNotifications(req,res,next);
           res.write(response);*/

            res.write("<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">");
            res.write("<d:response><d:href>/cal" + "/"+ req.params.username+"/"+req.params.calendar_id+"/" + "</d:href>");
            res.write("</d:response>");
            res.write("</d:multistatus>");

            res.status(207).end();
        }else if(calendar_id === "outbox"){
            response += returnOutbox(req,res,next);
            res.write(response);
            res.status(207).end();
        }else{

            // If not exists, create it
            CAL.find({ where: {pkey: calendar_id} }).then(function(cal){
                if(cal === null){
                    log.warn('Calendar not found, wait to create');
                    
                    log.debug(req.params);

                    var filename = ics_id.split('.')[0];

                    var timezone = `EGIN:VCALENDAR
PRODID:-//Example Corp.//CalDAV Client//EN
VERSION:2.0
BEGIN:VTIMEZONE
TZID:US-Eastern
LAST-MODIFIED:19870101T000000Z
BEGIN:STANDARD
DTSTART:19671029T020000
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:Eastern Standard Time (US &amp; Canada)
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19870405T020000
RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=4
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:Eastern Daylight Time (US &amp; Canada)
END:DAYLIGHT
END:VTIMEZONE
END:VCALENDAR`;

                    var defaults = {
                        owner: username,
                        timezone: timezone,
                        order: 'order',
                        free_busy_set: "YES",
                        supported_cal_component: "VEVENT",
                        colour: "#0E61B9FF",
                        displayname: filename,
                    };

                    CAL .findOrCreate({ where: {pkey: filename}, defaults: defaults })
                        .spread(function(cal, created){
                            if(created){
                                log.debug('Created CAL: ' + JSON.stringify(cal, null, 4));
                            }else{
                                log.debug('Loaded CAL: ' + JSON.stringify(cal, null, 4));
                            }

                            cal.save().then(function(){
                                log.warn('cal saved');
                                response += returnPropfindElements(req, res, next, cal, childs);

                                res.write("<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">");
                                res.write("<d:response><d:href>/cal" + "/"+ req.params.username+"/"+calendar_id+"/" + "</d:href>");

                                if(response.length > 0){
                                    res.write("<d:propstat>");
                                    res.write("<d:prop>");
                                    res.write(response);
                                    res.write("</d:prop>");
                                    res.write("<d:status>HTTP/1.1 200 OK</d:status>");
                                    res.write("</d:propstat>");
                                }

                                res.write("</d:response>");
                                res.write("</d:multistatus>");

                                createDefaultICS(req,res,next,ics_id);

                                log.debug('propfind over');

                                res.status(207).end();

                            });
             

                        });

                }else{
                    // for every ICS element, return the props...
                    response += returnPropfindElements(req, res, next, cal, childs);

                    res.write("<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">");
                    res.write("<d:response><d:href>/cal" + "/"+ req.params.username+"/"+calendar_id+"/" + "</d:href>");

                    if(response.length > 0){
                        res.write("<d:propstat>");
                        res.write("<d:prop>");
                        res.write(response);
                        res.write("</d:prop>");
                        res.write("<d:status>HTTP/1.1 200 OK</d:status>");
                        res.write("</d:propstat>");
                    }

                    res.write("</d:response>");
                    res.write("</d:multistatus>");
                }
                log.debug('propfind over');
                res.status(207).end();
            });
        }
    }
}

function createDefaultICS(req,res,next,ics_name){
    
           
        var ics_id = ics_name.split('.')[0];
        var calendar = req.params.calendar_id;

        var defaults = {
            calendarId: calendar,
            content: req.rawBody
        };

        ICS.findOrCreate({ where: {pkey: ics_id}, defaults: defaults}).spread(function(ics, created){

                if(created){
                    log.info('Created default ICS ');
                }else{
                    ics.content = req.rawBody;
                    log.info('Loaded ICS ');
                }

                ics.save().then(function(){

                    // update calendar collection
                    CAL.findOne({ where: {pkey: calendar} } ).then(function(cal){
                        if(cal !== null && cal !== undefined){
                            cal.increment('synctoken', { by: 1 }).then(function(){

                            });
                        }
                    });
            });
        });


}

function returnPropfindElements(req, res, next, calendar, childs){
    var response = "";

    var username = req.params.username;

    var token = calendar.synctoken;

    var len = childs.length;
    for (var i=0; i < len; ++i){
        var child = childs[i];
        var name = child.name();
        switch(name){
            case 'add-member':
                response += "";
                break;

            case 'allowed-sharing-modes':
                response += "<cs:allowed-sharing-modes><cs:can-be-shared/><cs:can-be-published/></cs:allowed-sharing-modes>";
                break;

            case 'autoprovisioned':
                response += "";
                break;

            case 'bulk-requests':
                response += "";
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
                var timezone = calendar.timezone;
                timezone = timezone.replace(/\r\n|\r|\n/g,'&#13;\r\n');

                response += "<cal:calendar-timezone>" + timezone + "</cal:calendar-timezone>";
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
                response += "<d:displayname>" + calendar.displayname + "</d:displayname>";
                break;

            case 'language-code':
                response += "";
                break;

            case 'location-code':
                response += "";
                break;

            case 'owner':
                response += "<d:owner><d:href>/p/" + username +"/</d:href></d:owner>";
                break;

            case 'pre-publish-url':
                response += "<cs:pre-publish-url><d:href>https://127.0.0.1/cal/" + username + "/" + calendar.pkey + "</d:href></cs:pre-publish-url>";
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
                response += "<d:resourcetype><d:collection/><cal:calendar/></d:resourcetype>";
                break;

            case 'schedule-calendar-transp':
                response += "<cal:schedule-calendar-transp><cal:opaque/></cal:schedule-calendar-transp>";
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
                response += "";
                break;

            case 'supported-calendar-component-sets':
                response += "<cal:supported-calendar-component-set><cal:comp name=\"VEVENT\"/></cal:supported-calendar-component-set>";
                break;

            case 'supported-report-set':
                response += getSupportedReportSet(false);
                break;

            case 'getctag':
                response += "<cs:getctag>http://swordlord.com/ns/sync/" + token + "</cs:getctag>";
                break;

            case 'getetag':
                // no response?
                break;

            case 'checksum-versions':
                // no response?
                break;

            case 'sync-token':
                response += "<d:sync-token>http://swordlord.com/ns/sync/" + token + "</d:sync-token>";
                break;

            case 'acl':
                response += getACL(req,res,next);
                break;

            case 'getcontenttype':
                //response += "<d:getcontenttype>text/calendar;charset=utf-8</d:getcontenttype>";
                break;

            default:
                if(name != 'text') log.warn("CAL-PF: not handled: " + name);
                break;
        }
    }

    return response;
}

function returnCalendar(req, res, next, calendar, childs){
    var response = "";
    var username = req.params.username;

    log.error(calendar.pkey);

    response += "	<d:response>";
    response += "		<d:href>/cal/" + username + "/" + calendar.pkey + "/</d:href>";
    response += "		<d:propstat>";
    response += "			<d:prop>";

    response += returnPropfindElements(req, res, next, calendar, childs);

    response += "			</d:prop>";
    response += "			<d:status>HTTP/1.1 200 OK</d:status>";
    response += "		</d:propstat>";
    response += "	</d:response>";

    log.error(`response is ${response}`);

    return response;
}

function getCalendarRootNodeResponse(req, res, next, childs){
    var response = "";

    var owner = req.params.username;

    response += "<d:response><d:href>/cal" + "/"+ req.params.username+"/"+req.params.calendar_id+"/" + "</d:href>";
    response += "<d:propstat>";
    response += "<d:prop>";

    var len = childs.length;
    for (var i = 0; i < len; ++i){
        var child = childs[i];
        var name = child.name();
        switch(name){
            case 'current-user-privilege-set':
                response += getCurrentUserPrivilegeSet();
                break;

            case 'owner':
                response += "<d:owner><d:href>/p/" + owner +"/</d:href></d:owner>";
                break;

            case 'resourcetype':
                response += "<d:resourcetype><d:collection/></d:resourcetype>";
                break;

            case 'supported-report-set':
                response += getSupportedReportSet(true);
                break;
        }
    }

    response += "</d:prop>";
    response += "<d:status>HTTP/1.1 200 OK</d:status>";
    response += "</d:propstat>";
    response += "</d:response>";


    return response;
}

function getSupportedReportSet(isRoot){
    var response = "";

    response += "<d:supported-report-set>";

    if(!isRoot){
        response += "<d:supported-report><d:report><cal:calendar-multiget/></d:report></d:supported-report>";
        response += "<d:supported-report><d:report><cal:calendar-query/></d:report></d:supported-report>";
        response += "<d:supported-report><d:report><cal:free-busy-query/></d:report></d:supported-report>";
    }

    response += "<d:supported-report><d:report><d:sync-collection/></d:report></d:supported-report>";
    response += "<d:supported-report><d:report><d:expand-property/></d:report></d:supported-report>";
    response += "<d:supported-report><d:report><d:principal-property-search/></d:report></d:supported-report>";
    response += "<d:supported-report><d:report><d:principal-search-property-set/></d:report></d:supported-report>";
    response += "</d:supported-report-set>";

    return response;
}

function getCurrentUserPrivilegeSet(){
    var response = "";

    response += "<d:current-user-privilege-set>";
    response += "<d:privilege xmlns:d=\"DAV:\"><cal:read-free-busy/></d:privilege>";
    response += "<d:privilege xmlns:d=\"DAV:\"><d:write/></d:privilege>";
    response += "<d:privilege xmlns:d=\"DAV:\"><d:write-acl/></d:privilege>";
    response += "<d:privilege xmlns:d=\"DAV:\"><d:write-content/></d:privilege>";
    response += "<d:privilege xmlns:d=\"DAV:\"><d:write-properties/></d:privilege>";
    response += "<d:privilege xmlns:d=\"DAV:\"><d:bind/></d:privilege>";
    response += "<d:privilege xmlns:d=\"DAV:\"><d:unbind/></d:privilege>";
    response += "<d:privilege xmlns:d=\"DAV:\"><d:unlock/></d:privilege>";
    response += "<d:privilege xmlns:d=\"DAV:\"><d:read/></d:privilege>";
    response += "<d:privilege xmlns:d=\"DAV:\"><d:read-acl/></d:privilege>";
    response += "<d:privilege xmlns:d=\"DAV:\"><d:read-current-user-privilege-set/></d:privilege>";
    response += "</d:current-user-privilege-set>";

    return response;
}

function getACL(req, res, next){
    var username = req.params.username;
    var response = "";

    response += "<d:acl>";
    response += "    <d:ace>";
    response += "        <d:principal><d:href>/p/" + username + "</d:href></d:principal>";
    response += "        <d:grant><d:privilege><d:read/></d:privilege></d:grant>";
    response += "        <d:protected/>";
    response += "    </d:ace>";

    response += "    <d:ace>";
    response += "        <d:principal><d:href>/p/" + username + "</d:href></d:principal>";
    response += "        <d:grant><d:privilege><d:write/></d:privilege></d:grant>";
    response += "        <d:protected/>";
    response += "    </d:ace>";

    response += "    <d:ace>";
    response += "        <d:principal><d:href>/p/" + username + "/calendar-proxy-write/</d:href></d:principal>";
    response += "        <d:grant><d:privilege><d:read/></d:privilege></d:grant>";
    response += "        <d:protected/>";
    response += "    </d:ace>";

    response += "    <d:ace>";
    response += "        <d:principal><d:href>/p/" + username + "/calendar-proxy-write/</d:href></d:principal>";
    response += "        <d:grant><d:privilege><d:write/></d:privilege></d:grant>";
    response += "        <d:protected/>";
    response += "    </d:ace>";

    response += "    <d:ace>";
    response += "        <d:principal><d:href>/p/" + username + "/calendar-proxy-read/</d:href></d:principal>";
    response += "        <d:grant><d:privilege><d:read/></d:privilege></d:grant>";
    response += "        <d:protected/>";
    response += "    </d:ace>";

    response += "    <d:ace>";
    response += "        <d:principal><d:authenticated/></d:principal>";
    response += "        <d:grant><d:privilege><cal:read-free-busy/></d:privilege></d:grant>";
    response += "        <d:protected/>";
    response += "    </d:ace>";

    response += "    <d:ace>";
    response += "        <d:principal><d:href>/p/system/admins/</d:href></d:principal>";
    response += "        <d:grant><d:privilege><d:all/></d:privilege></d:grant>";
    response += "        <d:protected/>";
    response += "    </d:ace>";

    return response;
}

function handleMkcalendar(req, res, next){
    log.debug("calendar.makeCalendar called");

    var response = "";

    helper.setStandardHeaders(res);

    var body = req.rawBody;
    log.debug(body);
    var xmlDoc = xml.parseXml(body);

    var node = xmlDoc.get('/B:mkcalendar/A:set/A:prop', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });

    var childs = node.childNodes();

    var timezone,
    order,
    free_busy_set,
    supported_cal_component,
    colour,
    displayname;

    var len = childs.length;
    if(len > 0){
        for (var i=0; i < len; ++i){
            var child = childs[i];
            var name = child.name();
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

        var filename = req.params.ics_id.split('.')[0];

        var defaults = {
            owner: req.params.username,
            timezone: timezone,
            order: order,
            free_busy_set: free_busy_set,
            supported_cal_component: supported_cal_component,
            colour: colour,
            displayname: displayname
        };

        CAL .findOrCreate({ where: {pkey: filename}, defaults: defaults })
            .spread(function(cal, created){
                if(created){
                    log.debug('Created CAL: ' + JSON.stringify(cal, null, 4));
                }else{
                    log.debug('Loaded CAL: ' + JSON.stringify(cal, null, 4));
                }

                cal.save().then(function(){
                    log.warn('cal saved');
                });
            });
            res.write(response);
            res.status(201).end();
    }else{
            res.write(response);
            res.status(500).end();
    }
}

function handleReport(req, res, next){
    log.debug("calendar.report called");

    helper.setStandardHeaders(res);

    res.write(helper.getXMLHead());

    var body = req.rawBody;
    log.debug(body);
    var xmlDoc = xml.parseXml(body);

    var rootNode = xmlDoc.root();

    var name = rootNode.name();
    switch(name){
        case 'sync-collection':
            handleReportSyncCollection(req,res,next);
            break;

        case 'calendar-multiget':
            handleReportCalendarMultiget(req,res,next);
            break;

        case 'calendar-query':
            handleReportCalendarQuery(req,res,next);
            break;

        default:
            if(name != 'text') 
                log.warn("CAL-Report: not handled: " + name);
            break;
    }
}

function handleReportCalendarQuery(req, res, next){

    var calendarId = req.params.calendar_id;

    CAL.find({ where: {pkey: calendarId} } ).then(function(cal){
        ICS.findAndCountAll({ where: {calendarId: calendarId}}).then(function(result){
                var body = req.rawBody;
                var xmlDoc = xml.parseXml(body);

                var nodeProp = xmlDoc.get('/B:calendar-query/A:prop', {
                    A: 'DAV:',
                    B: "urn:ietf:params:xml:ns:caldav",
                    C: 'http://calendarserver.org/ns/',
                    D: "http://apple.com/ns/ical/",
                    E: "http://me.com/_namespace/"
                });

                var nodeFilter = xmlDoc.get('/B:filter', {
                    A: 'DAV:',
                    B: "urn:ietf:params:xml:ns:caldav",
                    C: 'http://calendarserver.org/ns/',
                    D: "http://apple.com/ns/ical/",
                    E: "http://me.com/_namespace/"
                });

                var response = "";

                var nodeProps = nodeProp.childNodes();
                var len = nodeProps.length;

                for (var j=0; j < result.count; ++j){
                    var ics = result.rows[j];

                    response += "<d:response><d:href>/cal" +"/"+ req.params.username+"/"+req.params.calendar_id+"/" + "</d:href>";
                    response += "<d:propstat>";
                    response += "<d:prop>";

                    var date = Date.parse(ics.updatedAt);

                    for (var i=0; i < len; ++i){
                        var child = nodeProps[i];
                        var name = child.name();
                        switch(name){
                            case 'getetag':
                                response += "<d:getetag>\"" + Number(date) + "\"</d:getetag>";
                                break;

                            case 'getcontenttype':
                                response += "<d:getcontenttype>text/calendar; charset=utf-8; component=" + cal.supported_cal_component + "</d:getcontenttype>";
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

                    response += "</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>";
                    response += "</d:response>";
                }


                res.write("<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\" xmlns:ical=\"http://apple.com/ns/ical/\">\r\n");
                
                log.error(response);
                res.write(response);
                res.write("</d:multistatus>");

                res.end();
            });
    });

    /*
    *
    * <?xml version="1.0" encoding="UTF-8"?>
     <B:calendar-query xmlns:B="urn:ietf:params:xml:ns:caldav">
     <A:prop xmlns:A="DAV:">
        <A:getetag/>
        <A:getcontenttype/>
     </A:prop>
     <B:filter>
        <B:comp-filter name="VCALENDAR">
           <B:comp-filter name="VEVENT">
              <B:time-range start="20140107T000000Z"/>
           </B:comp-filter>
        </B:comp-filter>
     </B:filter>
     </B:calendar-query>
    * */
}

function handleReportSyncCollection(req, res, next){
    var body = req.rawBody;
    var xmlDoc = xml.parseXml(body);

    var node = xmlDoc.get('/A:sync-collection', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });

    if(node != undefined){
        var calendarId = req.params.calendar_id;

        CAL.find({ where: {pkey: calendarId} } ).then(function(cal){

            ICS.findAndCountAll({ where: {calendarId: calendarId}}
               /*{ where: {updatedAt: { gte: cal.updatedAt}}}*/
            ).then(function(result){
                var response = "";

                for (var j=0; j < result.count; ++j){
                    var ics = result.rows[j];

                    

                    var childs = node.childNodes();

                    var len = childs.length;
                    for (var i=0; i < len; ++i){
                        var child = childs[i];
                        var name = child.name();
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

                res.write("<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\" xmlns:ical=\"http://apple.com/ns/ical/\">\r\n");
                res.write(response);
                res.write("<d:sync-token>http://swordlord.org/ns/sync/" + cal.synctoken + "</d:sync-token>");
                res.write("</d:multistatus>");

                log.debug(`end report`)
                res.status(200).end();
            });
        });
    }
}

function handleReportCalendarProp(req, res, next, node, cal, ics){
    var response = "";

    response += "<d:response>";
    response += "<d:href>/cal/" + req.params.username +"/"+req.params.calendar_id + "/</d:href>";
    response += "<d:propstat><d:prop>";

    var childs = node.childNodes();

    var date = Date.parse(ics.updatedAt);

    var len = childs.length;
    for (var i=0; i < len; ++i){
        var child = childs[i];
        var name = child.name();
        switch(name){
            case 'getetag':
                response += "<d:getetag>\"" + Number(date) + "\"</d:getetag>";
                break;

            case 'getcontenttype':
                response += "<d:getcontenttype>text/calendar; charset=utf-8; component=" + cal.supported_cal_component + "</d:getcontenttype>";
                break;

            default:
                if(name != 'text') 
                    log.warn("CAL-Report: not handled: " + name);
                break;
        }
    }

    response += "</d:prop>";
    response += "<d:status>HTTP/1.1 200 OK</d:status>";
    response += "</d:propstat>";
    response += "</d:response>";

    return response;
}

function handleReportCalendarMultiget(req,res,next){
    var body = req.rawBody;
    var xmlDoc = xml.parseXml(body);

    var node = xmlDoc.get('/B:calendar-multiget', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });

    if(node != undefined){
        var childs = node.childNodes();

        var arrHrefs = [];

        var len = childs.length;
        for (var i=0; i < len; ++i){
            var child = childs[i];
            var name = child.name();
            switch(name){
                case 'prop': // TODO: theoretically we should first get the parameters ordered by the client, lets do so later :)
                    break;

                case 'href':
                    arrHrefs.push(parseHrefToIcsId(child.text()));
                    break;

                default:
                    if(name != 'text') log.warn("P-R: not handled: " + name);
                    break;
            }
        }

        handleReportHrefs(req, res, next, arrHrefs);
    }
}

function parseHrefToIcsId(href){
    var e = href.split("/");
    var id = e[e.length - 1];

    return id.substr(0, id.length - 4);
}

function handleReportHrefs(req, res, next, arrIcsIds){
    ICS.findAndCountAll( { where: {pkey: arrIcsIds}}).then(function(result){
        var response = "";

        for (var i=0; i < result.count; ++i){
            var ics = result.rows[i];

            var date = Date.parse(ics.updatedAt);

            response += "<d:response>";
            response += "<d:href>/cal" + "/"+ req.params.username+"/"+req.params.calendar_id+"/" + ics.pkey + ".ics</d:href>";
            response += "<d:propstat><d:prop>";
            response += "<cal:calendar-data>" + ics.content + "</cal:calendar-data>";
            response += "<d:getetag>\"" + Number(date) + "\"</d:getetag>";
            response += "</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>";
            response += "<d:propstat><d:prop>";
            response += "<cs:created-by/><cs:updated-by/>";
            response += "</d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat>";
            response += "</d:response>";
        }

        res.write("<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\" xmlns:ical=\"http://apple.com/ns/ical/\">\r\n");

        res.write(response);

        res.write("</d:multistatus>\r\n");

        res.end();
    });
}

function handleProppatch(req,res,next){
    log.debug("calendar.proppatch called");

    helper.setStandardHeaders(res);

    res.write(helper.getXMLHead());

    var body = req.rawBody;
    log.debug(body);
    var xmlDoc = xml.parseXml(body);

    var node = xmlDoc.get('/A:propertyupdate/A:set/A:prop', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });
    var childs = node.childNodes();

    var isRoot = true;

    // if URL element size === 4, this is a call for the root URL of a user.
    // TODO:

    if(req.url.split("/").length > 4){
        var lastPathElement = req.params.ics_id;
        if(helper.stringEndsWith(lastPathElement,'.ics')){
            isRoot = false;
        }
    }

    var response = "";

    if(isRoot){
        var calendarId = req.params.calendar_id;
        CAL.find({ where: {pkey: calendarId} }).then(function(cal){
            if(!cal){
                log.warn('Calendar not found');

                var len = childs.length;
                for (var i=0; i < len; ++i){
                    var child = childs[i];
                    var name = child.name();
                    switch(name){
                        case 'default-alarm-vevent-date':
                            response += "<cal:default-alarm-vevent-date/>";
                            log.info("proppatch default-alarm-vevent-date not handled yet");
                            break;

                        case 'default-alarm-vevent-datetime':
                            response += "<cal:default-alarm-vevent-datetime/>";
                            log.info("proppatch default-alarm-vevent-datetime not handled yet");
                            break;

                        default:
                            if(name != 'text') 
                                log.warn("Cal-proppatch: not handled: " + name);
                            break;
                    }
                }

                res.write("<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\" xmlns:ical=\"http://apple.com/ns/ical/\">\r\n");
                res.write("	<d:response>\r\n");
                res.write("		<d:href>/cal/" + req.params.username+"/"+req.params.calendar_id + "/</d:href>\r\n");
                res.write("		<d:propstat>\r\n");
                res.write("			<d:prop>\r\n");
                res.write(response);
                res.write("			</d:prop>\r\n");
                res.write("			<d:status>HTTP/1.1 403 Forbidden</d:status>\r\n");
                res.write("		</d:propstat>\r\n");
                res.write("	</d:response>\r\n");
                res.write("</d:multistatus>\r\n");
            }else{
                var len = childs.length;
                for (var i=0; i < len; ++i){
                    var child = childs[i];
                    var name = child.name();
                    switch(name){
                        case 'default-alarm-vevent-date':
                            response += "<cal:default-alarm-vevent-date/>";
                            log.info("proppatch default-alarm-vevent-date not handled yet");
                            break;

                        case 'default-alarm-vevent-datetime':
                            response += "<cal:default-alarm-vevent-datetime/>";
                            log.info("proppatch default-alarm-vevent-datetime not handled yet");
                            break;

                        case 'displayname':
                            response += "<cal:displayname/>";
                            cal.displayname = child.text();
                            break;

                        case 'calendar-timezone':
                            response += "<cal:calendar-timezone/>";
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

                cal.save().then(function(){
                    log.warn('cal saved');
                });

                res.write("<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\" xmlns:ical=\"http://apple.com/ns/ical/\">\r\n");
                res.write("	<d:response>\r\n");
                res.write("		<d:href>" + "/"+ req.params.username+"/"+req.params.calendar_id+"/" + "</d:href>\r\n");
                res.write("		<d:propstat>\r\n");
                res.write("			<d:prop>\r\n");
                res.write(response);
                res.write("			</d:prop>\r\n");
                res.write("			<d:status>HTTP/1.1 200 OK</d:status>\r\n");
                res.write("		</d:propstat>\r\n");
                res.write("	</d:response>\r\n");
                res.write("</d:multistatus>\r\n");
            }

            res.status(200).end();
        });
    }

    
}

function returnOutbox(req,res,next){
    var response = "";

    var username = req.params.username

    response += "<d:response>";
    response += "   <d:href>/cal/" + username + "/outbox/</d:href>";
    response += "    <d:propstat>";
    response += "        <d:prop>";
    response += "            <d:current-user-privilege-set>";
    response += "               <d:privilege xmlns:d=\"DAV:\">";
    response += "                   <d:read/>";
    response += "               </d:privilege>";
    response += "               <d:privilege xmlns:d=\"DAV:\">";
    response += "                   <d:read-acl/>";
    response += "               </d:privilege>";
    response += "               <d:privilege xmlns:d=\"DAV:\">";
    response += "                   <d:read-current-user-privilege-set/>";
    response += "               </d:privilege>";
    response += "               <d:privilege xmlns:d=\"DAV:\">";
    response += "                   <d:schedule-post-vevent xmlns:d=\"urn:ietf:params:xml:ns:caldav\"/>";
    response += "               </d:privilege>";
    response += "               <d:privilege xmlns:d=\"DAV:\">";
    response += "                   <d:schedule-query-freebusy xmlns:d=\"urn:ietf:params:xml:ns:caldav\"/>";
    response += "               </d:privilege>";
    response += "           </d:current-user-privilege-set>";
    response += "           <d:owner>";
    response += "               <d:href>/p/" + username + "/</d:href>";
    response += "           </d:owner>";
    response += "           <d:resourcetype>";
    response += "              <d:collection/>";
    response += "               <cal:schedule-outbox/>";
    response += "           </d:resourcetype>";
    response += "           <d:supported-report-set>";
    response += "              <d:supported-report>";
    response += "                   <d:report>";
    response += "                       <d:expand-property/>";
    response += "                   </d:report>";
    response += "               </d:supported-report>";
    response += "               <d:supported-report>";
    response += "                   <d:report>";
    response += "                       <d:principal-property-search/>";
    response += "                   </d:report>";
    response += "               </d:supported-report>";
    response += "               <d:supported-report>";
    response += "                    <d:report>";
    response += "                       <d:principal-search-property-set/>";
    response += "                   </d:report>";
    response += "               </d:supported-report>";
    response += "            </d:supported-report-set>";
    response += "       </d:prop>";
    response += "       <d:status>HTTP/1.1 200 OK</d:status>";
    response += "   </d:propstat>";
    response += "</d:response>";

    return response;
}

function returnNotifications(req,res,next){
    var response = "";

    var username = req.params.username;

    response += "<d:response>";
    response += "<d:href>/cal/" + username + "/notifications/</d:href>";
    response += "<d:propstat>";
    response += "    <d:prop>";
    response += "        <d:current-user-privilege-set>";
    response += "            <d:privilege xmlns:d=\"DAV:\">";
    response += "                <d:write/>";
    response += "           </d:privilege>";
    response += "           <d:privilege xmlns:d=\"DAV:\">";
    response += "               <d:write-acl/>";
    response += "           </d:privilege>";
    response += "           <d:privilege xmlns:d=\"DAV:\">";
    response += "               <d:write-properties/>";
    response += "          </d:privilege>";
    response += "           <d:privilege xmlns:d=\"DAV:\">";
    response += "               <d:write-content/>";
    response += "           </d:privilege>";
    response += "            <d:privilege xmlns:d=\"DAV:\">";
    response += "               <d:bind/>";
    response += "            </d:privilege>";
    response += "            <d:privilege xmlns:d=\"DAV:\">";
    response += "                <d:unbind/>";
    response += "            </d:privilege>";
    response += "            <d:privilege xmlns:d=\"DAV:\">";
    response += "                <d:unlock/>";
    response += "           </d:privilege>";
    response += "           <d:privilege xmlns:d=\"DAV:\">";
    response += "               <d:read/>";
    response += "           </d:privilege>";
    response += "           <d:privilege xmlns:d=\"DAV:\">";
    response += "                <d:read-acl/>";
    response += "           </d:privilege>";
    response += "           <d:privilege xmlns:d=\"DAV:\">";
    response += "               <d:read-current-user-privilege-set/>";
    response += "            </d:privilege>";
    response += "       </d:current-user-privilege-set>";
    response += "       <d:owner>";
    response += "           <d:href>/p/" + username + "/</d:href>";
    response += "       </d:owner>";
    response += "       <d:resourcetype>";
    response += "           <d:collection/>";
    response += "           <cs:notification/>";
    response += "       </d:resourcetype>";
    response += "       <d:supported-report-set>";
    response += "           <d:supported-report>";
    response += "               <d:report>";
    response += "                   <d:expand-property/>";
    response += "               </d:report>";
    response += "           </d:supported-report>";
    response += "           <d:supported-report>";
    response += "               <d:report>";
    response += "                   <d:principal-property-search/>";
    response += "               </d:report>";
    response += "           </d:supported-report>";
    response += "          <d:supported-report>";
    response += "               <d:report>";
    response += "                  <d:principal-search-property-set/>";
    response += "              </d:report>";
    response += "           </d:supported-report>";
    response += "       </d:supported-report-set>";
    response += "   </d:prop>";
    response += "<d:status>HTTP/1.1 200 OK</d:status>";
    response += "</d:propstat>";
    response += "</d:response>";

    return response;
}

function handleOptions(req,res,next){
    log.debug("principal.options called");

    helper.setStandardHeaders(res);
    helper.setDAVHeaders(res);

    res.status(200).end();
}

function handleNewPut(req,res,next){

    log.debug("calendar.newput called");

    var ics_id = req.params.new_ics_id.split('.')[0];
    var calendar_id = req.params.calendar_id;

    var defaults = {
        calendarId: calendar_id,
        content: req.rawBody || "rawBody not being accepted1",
    };

    log.error(ics_id);


    ICS
       .findOrCreate({ where: {pkey: ics_id}, defaults: defaults})
       .spread(function(ics, created){
            if(created){
                log.debug('Created ICS: ' + JSON.stringify(ics, null, 4));
            }else{
                ics.content = req.rawBody || "rawBody not being accepted2",
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

    helper.setStandardHeaders(res);

    var date = new Date();
    res.set("ETag", Number(date));

    res.status(201).end();
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

    helper.setStandardHeaders(res);

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
        if(helper.stringEndsWith(lastPathElement,'.ics')){
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
        var ics_id = req.params.ics_id.split('.')[0];

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

    helper.setStandardHeaders(res);

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


