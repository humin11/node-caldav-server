import db from './db';
import log from '../utils/log'
import xml from 'libxmljs'
import helper from '../utils/caldavHelper'
import { mountedPath } from '../conf/config';

export default {
    handlePropfind,
    handleProppatch,
    handleOptions,
    handleReport,
}

function handlePropfind(req,res,next){
    log.debug("principal.propfind called");

    helper.setStandardHeaders(res);
    helper.setDAVHeaders(res);

    res.writeHead(207);
    
    res.write("<?xml version=\"1.0\" encoding=\"utf-8\"?>");

    let body = req.rawBody;

    log.debug(body);

    let xmlDoc = xml.parseXml(body);

    let node = xmlDoc.get('/A:propfind/A:prop', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });
    let childs = node.childNodes();

    let response = "";

    let len = childs.length;
    for (let i=0; i < len; ++i){
        let child = childs[i];
        let name = child.name();
        switch(name){
            case 'checksum-versions':
                response += "";
                break;

            case 'sync-token':
                response += "<sync-token>http://sabredav.org/ns/sync/5</sync-token>";
                break;

            case 'supported-report-set':
                response += getSupportedReportSet(req,res,next);
                break;

            case 'principal-URL':
            
                response += "<principal-URL><href>" + mountedPath.principalPath + "/" + req.user + "/</href></principal-URL>\r\n";
                break;

            case 'displayname':
                response += "<displayname>" + req.user + "</displayname>";
                break;

            case 'principal-collection-set':
                response += "<principal-collection-set><href>" + mountedPath.principalPath +"/</href></principal-collection-set>";
                break;

            case 'current-user-principal':
                response += "<current-user-principal><href>" + mountedPath.principalPath + "/" + req.user + "/</href></current-user-principal>";
                break;

            case 'calendar-home-set':
                response += "<calendar-home-set><href>" + mountedPath.calDavPath + "/" + req.user + "</href></calendar-home-set>";
                break;

            case 'schedule-outbox-URL':
                response += "<schedule-outbox-URL><href>" + mountedPath.calDavPath +"/" + req.user + "/outbox</href></schedule-outbox-URL>";
                break;

            case 'calendar-user-address-set':
                response += getCalendarUserAddressSet(req,res,next);
                break;

            case 'notification-URL':
                response += "<notification-URL><href>" + mountedPath.calDavPath +"/" + req.user + "/notifications/</href></notification-URL>";
                break;

            case 'getcontenttype':
                response += "";
                break;

            case 'addressbook-home-set':
                response += "";
                break;

            case 'directory-gateway':
                response += "";
                break;
            case 'email-address-set':
                response += "";
                break;
            case 'resource-id':
                response += "";
                break;

            default:
                if(name != 'text') 
                    log.warn("Principle-PropFind: not handled: " + name);
                break;
        }
    }

    res.write("<multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">");
    res.write("<response>");
    res.write("<propstat>");
    res.write("<prop>");
    res.write(response);
    res.write("</prop>");
    res.write("<status>HTTP/1.1 200 OK</status>");
    res.write("</propstat>");
    res.write("</response>");
    res.write("</multistatus>");
    res.end();
}

function getSupportedReportSet(req,res,next){
    let response = "";
    response += "        <supported-report-set>\r\n";
    response += "        	<supported-report>\r\n";
    response += "        		<report>\r\n";
    response += "        			<expand-property/>\r\n";
    response += "        		</report>\r\n";
    response += "        	</supported-report>\r\n";
    response += "        	<supported-report>\r\n";
    response += "        		<report>\r\n";
    response += "        			<principal-property-search/>\r\n";
    response += "        		</report>\r\n";
    response += "        	</supported-report>\r\n";
    response += "        	<supported-report>\r\n";
    response += "        		<report>\r\n";
    response += "        			<principal-search-property-set/>\r\n";
    response += "        		</report>\r\n";
    response += "        	</supported-report>\r\n";
    response += "        </supported-report-set>\r\n";

    return response;
}

function getCalendarUserAddressSet(req){
    let response = "";

    response += "        <calendar-user-address-set>\r\n";
    response += "        	<href>mailto:lord test at swordlord.com</href>\r\n";
    response += "        	<href>" + mountedPath.principalPath + "/" + req.user + "/</href>\r\n";
    response += "        </calendar-user-address-set>\r\n";

    return response;
}

function handleReport(req,res,next){
    log.debug("principal.report called");

    helper.setStandardHeaders(res);

    res.write("<?xml version=\"1.0\" encoding=\"utf-8\"?>");

    let body = req.rawBody;

    log.debug(body);

    let xmlDoc = xml.parseXml(body);


    let node = xmlDoc.get('/A:propfind/A:prop', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });

    let response = "";

    log.debug('here2');

    if(node != undefined){
        let childs = node.childNodes();

        let len = childs.length;
        for (let i=0; i < len; ++i){
            let child = childs[i];
            let name = child.name();
            switch(name){
                case 'principal-search-property-set':
                    response += getPrincipalSearchPropertySet(req,res,next);
                    break;

                default:
                    if(name != 'text') 
                        log.warn("Principal-Report: not handled: " + name);
                    break;
            }
        }
    }


    node = xmlDoc.get('/A:principal-search-property-set', {
        A: 'DAV:',
        B: "urn:ietf:params:xml:ns:caldav",
        C: 'http://calendarserver.org/ns/',
        D: "http://apple.com/ns/ical/",
        E: "http://me.com/_namespace/"
    });

    if(node != undefined){
        let name = node.name();
        switch(name){
            case 'principal-search-property-set':
                response += getPrincipalSearchPropertySet(req,res,next);
                break;

            default:
                if(name != 'text') 
                    log.warn("Principal-Report: " + name);
                break;
        }
    }

    // TODO: clean up
    res.write(response);

    if(isReportPropertyCalendarProxyWriteFor(req)){
        replyPropertyCalendarProxyWriteFor(req,res,next);
    }

    res.end();
}

function isReportPropertyCalendarProxyWriteFor(request){
    let body = request.rawBody;
    let xmlDoc = xml.parseXml(body);

    let node = xmlDoc.get('/A:expand-property/A:property[@name=\'calendar-proxy-write-for\']', { A: 'DAV:', C: 'http://calendarserver.org/ns/'});

    return typeof node != 'undefined';
}

function replyPropertyCalendarProxyWriteFor(req,res,next){
    let body = req.rawBody;
    res.write("<multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">\r\n");
    res.write("<response>");
    res.write("    <href>" + url + "</href>");
    res.write("    <propstat>");
    res.write("       <prop>");
    res.write("           <calendar-proxy-read-for/>");
    res.write("           <calendar-proxy-write-for/>");
    res.write("       </prop>");
    res.write("        <status>HTTP/1.1 200 OK</status>");
    res.write("    </propstat>");
    res.write("</response>");
    res.write("</multistatus>\r\n");
}

function getPrincipalSearchPropertySet(req,res,next){
    let response = "";
    response += "<principal-search-property-set xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">\r\n";
    response += "  <principal-search-property>\r\n";
    response += "    <prop>\r\n";
    response += "      <displayname/>\r\n";
    response += "    </prop>\r\n";
    response += "    <description xml:lang=\"en\">Display name</description>\r\n";
    response += "  </principal-search-property>\r\n";
//    response += "  <principal-search-property>\r\n";
//    response += "    <prop>\r\n";
//    response += "      <s:email-address/>\r\n";
//    response += "    </prop>\r\n";
//    response += "    <description xml:lang=\"en\">Email address</description>\r\n";
//    response += "  </principal-search-property>\r\n";
    response += "</principal-search-property-set>\r\n";

    return response;
}


function handleProppatch(req,res,next){
    log.debug("principal.proppatch called");

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Server", "Caldav");

    let url = req.originalUrl;

    res.write("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
    res.write("<multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">\r\n");
    res.write("	<response>\r\n");
    res.write("		<href>" + url + "</href>\r\n");
    res.write("		<propstat>\r\n");
    res.write("			<prop>\r\n");
    res.write("				<default-alarm-vevent-date/>\r\n");
    res.write("			</prop>\r\n");
    res.write("			<status>HTTP/1.1 403 Forbidden</status>\r\n");
    res.write("		</propstat>\r\n");
    res.write("	</response>\r\n");
    res.write("</multistatus>\r\n");

    res.status(200).end();
}

function handleOptions(req,res,next){
    log.debug("principal.options called");

    helper.setStandardHeaders(res);
    helper.setDAVHeaders(res);
    helper.setAllowHeader(res);

    res.status(200).end();
}
