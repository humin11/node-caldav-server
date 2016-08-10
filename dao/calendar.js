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
    res.writeHead(207);
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
    log.error(`calendar_id: ${calendar_id}`);
    
    var ics_id = req.params.ics_id || calendar_id;

    log.debug(`url: ${req.url}`)

    // if last element === username, then get all calendar info of user, otherwise only from that specific calendar
    //var lastelement = request.getLastPathElement();

    // if URL element size === 3, this is a call for the root URL of a user.
    // TODO:

    if(req.url.split("/").length > 3){
        isRoot = false;
    }else if(req.url === "/"){
        response += "<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">";

        var len = childs.length;
        for (var i=0; i < len; ++i){
            var child = childs[i];
            var name = child.name();
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
            }
        }

        response += "</multistatus>";
        res.write(response);
        res.end();
        return;
    }

    if(isRoot === true){
        log.debug('isRoot: true');
        var nodeChecksum = xmlDoc.get('/A:propfind/A:prop/C:checksum-versions', {   A: 'DAV:',
            B: "urn:ietf:params:xml:ns:caldav",
            C: 'http://calendarserver.org/ns/',
            D: "http://apple.com/ns/ical/",
            E: "http://me.com/_namespace/"
        });

        if(nodeChecksum !== undefined){
            response += "<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">";
            response += "<response><href>/cal" + "/"+ req.params.username+"/" + calendar_id+"/" + "</href></response>";
            response += "</multistatus>";
            res.write(response);
            log.debug(`1response:`)
            res.end();
        }else{
            // first get the root node info
            response += "<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">";
            // response += getCalendarRootNodeResponse(req, res, next, childs);

            // then add info for all further known calendars of same user
            var query = { where: { owner: username}, order: [['order', 'ASC']] };

            CAL.findAndCountAll(query).then(function(result){

                for (var i=0; i < result.count; ++i){
                        var calendar = result.rows[i];
                        if(calendar.pkey == calendar_id){
                            log.debug('found root calendar')
                            var isRoot = true;
                            var returnedCalendar = returnCalendar(req, res, next, calendar, childs, isRoot);
                            response +=returnedCalendar;
                        }else{
                            var isRoot = false;
                            var returnedCalendar = returnCalendar(req, res, next, calendar, childs, isRoot);
                                response +=returnedCalendar;
                        }
                }

                // response += returnOutbox(req, res, next);
                // response += returnNotifications(req, res, next);

                response += "</multistatus>";
                res.write(response);
                log.debug(`2response`)
                res.end();
            });


        }
    }else{
        log.debug('is root false');
        // otherwise get that specific calendar information

        if(calendar_id === "notifications"){
           /*response += returnNotifications(req,res,next);
           res.write(response);*/

            res.write("<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">");
            res.write("<response><href>/cal" + "/"+ req.params.username+"/"+req.params.calendar_id+"/" + "</href>");
            res.write("</response>");
            res.write("</multistatus>");

            res.end();
        }else if(calendar_id === "outbox"){
            response += returnOutbox(req,res,next);
            res.write(response);
            res.end();
        }else{

            // If not exists, create it
            CAL.find({ where: {pkey: calendar_id} }).then(function(cal){
                if(cal === null){
                    log.warn('Calendar not found, wait to create');
                    
                    log.debug(req.params);

                    var timezone = "BEGIN:VCALENDAR";
                        timezone+="PRODID:-//Example Corp.//CalDAV Client//EN";
                        timezone+="VERSION:2.0";
                        timezone+="BEGIN:VTIMEZONE";
                        timezone+="TZID:US-Eastern";
                        timezone+="LAST-MODIFIED:19870101T000000Z";
                        timezone+="BEGIN:STANDARD";
                        timezone+="DTSTART:19671029T020000";
                        timezone+="RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10";
                        timezone+="TZOFFSETFROM:-0400";
                        timezone+="TZOFFSETTO:-0500";
                        timezone+="TZNAME:Eastern Standard Time (US &amp; Canada)";
                        timezone+="END:STANDARD";
                        timezone+="BEGIN:DAYLIGHT";
                        timezone+="DTSTART:19870405T020000";
                        timezone+="RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=4";
                        timezone+="TZOFFSETFROM:-0500";
                        timezone+="TZOFFSETTO:-0400";
                        timezone+="TZNAME:Eastern Daylight Time (US &amp; Canada)";
                        timezone+="END:DAYLIGHT";
                        timezone+="END:VTIMEZONE";
                        timezone+="END:VCALENDAR";

                    var defaults = {
                        owner: username,
                        timezone: timezone,
                        order: 'order',
                        free_busy_set: "YES",
                        supported_cal_component: "VEVENT",
                        colour: "#0E61B9FF",
                        displayname: calendar_id,
                    };

                    CAL .findOrCreate({ where: {pkey: calendar_id}, defaults: defaults })
                        .spread(function(cal, created){
                            if(created){
                                log.debug('Created CAL: ' + JSON.stringify(cal, null, 4));
                            }else{
                                log.debug('Loaded CAL: ' + JSON.stringify(cal, null, 4));
                            }

                            cal.save().then(function(){

                                response += "<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">";
                                // response += getCalendarRootNodeResponse(req, res, next, childs);

                                // then add info for all further known calendars of same user
                                var query = { where: {owner: username}, order: [['order', 'ASC']] };

                                CAL.findAndCountAll(query).then(function(result){

                                    for (var i=0; i < result.count; ++i){
                                        var calendar = result.rows[i];
                                        if(calendar.pkey == calendar_id){
                                            log.debug('found root calendar')
                                            var isRoot = true;
                                            var returnedCalendar = returnCalendar(req, res, next, calendar, childs, isRoot);
                                            response +=returnedCalendar;
                                        }else{
                                            log.debug('found ics')
                                            var isRoot = false;
                                            var returnedCalendar = returnCalendar(req, res, next, calendar, childs, isRoot);
                                            response += returnedCalendar;
                                        }
                                    }

                                    // response += returnOutbox(req, res, next);
                                    // response += returnNotifications(req, res, next);

                                    response += "</multistatus>";
                                    res.write(response);
                                    log.error(`2response`)
                                    res.end();
                                });

                            });
             

                        });

                }else{
                    // for every ICS element, return the props...
                    // response += returnPropfindElements(req, res, next, cal, childs);

                    response += "<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">";
                    // response += getCalendarRootNodeResponse(req, res, next, childs);

                    // then add info for all further known calendars of same user
                    var query = { where: {owner: username}, order: [['order', 'ASC']] };

                    CAL.findAndCountAll(query).then(function(result){

                        for (var i=0; i < result.count; ++i){
                            var calendar = result.rows[i];
                            if(calendar.pkey == calendar_id){
                                log.debug('found root calendar')
                                var isRoot = true;
                                var returnedCalendar = returnCalendar(req, res, next, calendar, childs, isRoot);
                                response += returnedCalendar;
                            }else{
                                log.debug('found other calendar')
                                var isRoot = false;
                                var returnedCalendar = returnCalendar(req, res, next, calendar, childs, isRoot);
                                response += returnedCalendar;
                            }
                        }

                        ICS
                            .findAndCountAll({ where: {calendarId: calendar_id}})
                            .then(function(resultICS){
                                log.debug(calendar_id);
                                if(!resultICS){
                                    log.debug('not found ics');
                                }else{
                                    for(var i=0,len=resultICS.count;i<len;i++){
                                        var ics = resultICS.rows[i];
                                        log.debug(`found ics:${ics.pkey}`);
                                        var isRoot = false;
                                        var returnedCalendar = returnICSCalendar(req, res, next, ics, childs);
                                        response += returnedCalendar;
                                    }    
                                }


                                    response += "</multistatus>";
                                    res.write(response);
                                    log.error(`0response`)
                                    res.end();

                                });   


                        // response += returnOutbox(req, res, next);
                        // response += returnNotifications(req, res, next);


                    });

                    // res.write("<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\">");
                    // res.write("<response><href>/cal" + "/"+ req.params.username+"/"+calendar_id+"/" + "</href>");

                    // if(response.length > 0){
                    //     res.write("<propstat>");
                    //     res.write("<prop>");
                    //     res.write(response);
                    //     res.write("</prop>");
                    //     res.write("<status>HTTP/1.1 200 OK</status>");
                    //     res.write("</propstat>");
                    // }

                    // res.write("</response>");
                    // res.write("</multistatus>");
                    // log.debug('propfind over');
                    // res.end();
                }

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

function returnPropfindElements(req, res, next, calendar, childs, isRoot, tempArr){
    var response = "";

    if(typeof isRoot == "undefined"){
        isRoot = false;
    }

    tempArr = tempArr || [];

    var username = req.params.username;

    var token = calendar.synctoken;

    var len = childs.length;
    var date = Date.parse(calendar.updatedAt);

    var len = childs.length;
    for (var i=0; i < len; ++i){
        var child = childs[i];
        var name = child.name();
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
                response += "<CS:pre-publish-url><href>https://127.0.0.1:9876/cal/" + username + "/" + calendar.pkey + "</href></CS:pre-publish-url>";
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
                response += "<CS:getctag>\"" + calendar.pkey + Number(date) + "\"</CS:getctag>";
                // response += "<CS:getctag>\"d41d8cd98f00b204e9800998ecf8427e\"</CS:getctag>";
                break;

            case 'getetag':
                response += "<getetag>\"" + Number(date) + "\"</getetag>";
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

function returnPropfindICSElements(req, res, next, ics, childs, tempArr){
    var response = "";

    tempArr = tempArr || [];

    var username = req.params.username;

    var len = childs.length;
    var date = Date.parse(ics.updatedAt);

    var len = childs.length;
    for (var i=0; i < len; ++i){
        var child = childs[i];
        var name = child.name();
        switch(name){
            case 'getetag':
                response += "<getetag>\"" + Number(date) + "\"</getetag>";
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
    var response = "";
    var username = req.params.username;

    response += "	<response>";
    response += "		<href>/cal/" + username + "/" + ics.calendarId + "/" + ics.pkey + "</href>";
    response += "		<propstat>";
    response += "			<prop>";

    var tempArr = [];

    var returned = returnPropfindICSElements(req, res, next, ics, childs, tempArr);
    response += returned;

    response += "			</prop>";
    response += "			<status>HTTP/1.1 200 OK</status>";
    response += "		</propstat>";
    for(var j=0;j<tempArr.length;j++){
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
    var response = "";
    var username = req.params.username;

    if(typeof isRoot == "undefined"){
        isRoot = false;
    }

    response += "	<response>";
    response += "		<href>/cal/" + username + "/" + calendar.pkey + "/</href>";
    response += "		<propstat>";
    response += "			<prop>";

    var tempArr = [];

    var returned = returnPropfindElements(req, res, next, calendar, childs, isRoot, tempArr);
    response += returned;

    response += "			</prop>";
    response += "			<status>HTTP/1.1 200 OK</status>";
    response += "		</propstat>";
    if(isRoot == true){
        for(var j=0;j<tempArr.length;j++){
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


// depressed, use returnCalendar instead
function getCalendarRootNodeResponse(req, res, next, childs, updatedAt){
    var response = "";

    var updatedAt = updatedAt || new Date();

    var owner = req.params.username;


    response += "<response><href>/cal" + "/"+ req.params.username+"/"+req.params.calendar_id+"/" + "</href>";
    response += "<propstat>";
    response += "<prop>";

    tempArr = [];

    var len = childs.length;
    var date = Date.parse(updatedAt);

    for (var i = 0; i < len; ++i){
        var child = childs[i];
        var name = child.name();

        switch(name){
            case 'current-user-privilege-set':
                response += getCurrentUserPrivilegeSet();
                break;

            case 'owner':
                response += "<owner>/p/" + owner +"/</owner>";
                break;

            case 'resourcetype':
                response += "<resourcetype><C:calendar/><collection/></resourcetype>";
                break;

            case 'supported-report-set':
                response += getSupportedReportSet(true);
                break;
            case 'supported-calendar-component-set':
                response +=  `<C:supported-calendar-component-set>`
                // response +=  `<C:comp name="VTODO"/>`
                response +=  `<C:comp name="VEVENT"/>`
                // response +=  `<C:comp name="VJOURNAL"/>`
                response +=  `</C:supported-calendar-component-set>`
                break;

            case 'getetag':
                response += "<getetag>\"" + Number(date) + "\"</getetag>";
                break;
            
            default:
                log.debug('not handdled line 566:'+name);
                if(typeof tempArr != "undefined"){
                    tempArr.push(name);
                }
                break;
        }
    }


    response += "</prop>";
    response += "<status>HTTP/1.1 200 OK</status>";
    response += "</propstat>";

    for(var j=0;j<tempArr.length;j++){
        response +=`<propstat>`
        response +=`<prop>`
        response +=`<${tempArr[j]}/>`
        response +=`</prop>`
        response +=`<status>HTTP/1.1 404 Not Found</status>`
        response +=`</propstat>`
    }
    response += "</response>";


    return response;
}

function getSupportedReportSet(isRoot){
    var response = "";

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
    var response = "";

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
    var username = req.params.username;
    var response = "";

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
            res.writeHead(201);
            res.write(response);
            res.end();
    }else{
            res.writeHead(500);
            res.write(response);
            res.end();
    }
}

function handleReport(req, res, next){
    log.debug("calendar.report called");

    helper.setStandardHeaders(res);
    res.writeHead(207);
    res.write(helper.getXMLHead());

    var body = req.rawBody;
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

                    response += "<response><href>/cal" +"/"+ req.params.username+"/"+req.params.calendar_id+"/" + "</href>";
                    response += "<propstat>";
                    response += "<prop>";

                    var date = Date.parse(ics.updatedAt);

                    for (var i=0; i < len; ++i){
                        var child = nodeProps[i];
                        var name = child.name();
                        switch(name){
                            case 'getetag':
                                response += "<getetag>\"" + Number(date) + "\"</getetag>";
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
                
                log.error(response);
                res.write(response);
                res.write("</multistatus>");

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

                res.write("<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\" xmlns:ical=\"http://apple.com/ns/ical/\">\r\n");
                res.write(response);
                res.write("<sync-token>http://swordlord.org/ns/sync/" + cal.synctoken + "</sync-token>");
                res.write("</multistatus>");

                log.debug(`end report`)
                res.status(200).end();
            });
        });
    }
}

function handleReportCalendarProp(req, res, next, node, cal, ics){
    var response = "";

    response += "<response>";
    response += "<href>/cal/" + req.params.username +"/"+req.params.calendar_id + "/</href>";
    response += "<propstat><prop>";

    var childs = node.childNodes();

    var date = Date.parse(ics.updatedAt);

    var len = childs.length;
    for (var i=0; i < len; ++i){
        var child = childs[i];
        var name = child.name();
        switch(name){
            case 'getetag':
                response += "<getetag>\"" + Number(date) + "\"</getetag>";
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

    // return id.substr(0, id.length - 4);
    return id;
}

function handleReportHrefs(req, res, next, arrIcsIds){
    ICS.findAndCountAll( { where: {pkey: arrIcsIds}}).then(function(result){
        var response = "";

        for (var i=0; i < result.count; ++i){
            var ics = result.rows[i];

            var date = Date.parse(ics.updatedAt);

            response += "<response>";
            response += "<href>/cal" + "/"+ req.params.username+"/"+req.params.calendar_id+"/" + ics.pkey + "</href>";
            response += "<propstat><prop>";
            response += "<getetag>\"" + Number(date) + "\"</getetag>";
            response += "<C:calendar-data>" + ics.content + "</C:calendar-data>";

            log.error(`final etag: ${Number(date)}`)
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
                res.write("		<href>/cal/" + req.params.username+"/"+req.params.calendar_id + "/</href>\r\n");
                res.write("		<propstat>\r\n");
                res.write("			<prop>\r\n");
                res.write(response);
                res.write("			</prop>\r\n");
                res.write("			<status>HTTP/1.1 403 Forbidden</status>\r\n");
                res.write("		</propstat>\r\n");
                res.write("	</response>\r\n");
                res.write("</multistatus>\r\n");
            }else{
                var len = childs.length;
                for (var i=0; i < len; ++i){
                    var child = childs[i];
                    var name = child.name();
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

                cal.save().then(function(){
                    log.warn('cal saved');
                });

                res.write("<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\" xmlns:CS=\"http://calendarserver.org/ns/\" xmlns:ical=\"http://apple.com/ns/ical/\">\r\n");
                res.write("	<response>\r\n");
                res.write("		<href>" + "/"+ req.params.username+"/"+req.params.calendar_id+"/" + "</href>\r\n");
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
        });
    }

    
}

function returnOutbox(req,res,next){
    var response = "";

    var username = req.params.username

    response += "<response>";
    response += "   <href>/cal/" + username + "/outbox/</href>";
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
    var response = "";

    var username = req.params.username;

    response += "<response>";
    response += "<href>/cal/" + username + "/notifications/</href>";
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

    var ics_id = req.params.ics_id;
    var calendar_id = req.params.calendar_id;

    log.error(req.rawBody);

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

            helper.setStandardHeaders(res);

            var date = ics.updatedAt;
            var etag = Number(Date.parse(date));
            // log.error(`saved updatedAt : ${date}`);
            log.error(`saved etag : ${etag}`);
            res.set("ETag", etag);

            res.status(201).end();

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
    if(req.url.split("/").length > 3){
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
        var ics_id = req.params.ics_id;

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


