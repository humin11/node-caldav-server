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
                response += "<d:sync-token>http://sabredav.org/ns/sync/5</d:sync-token>";
                break;

            case 'supported-report-set':
                response += getSupportedReportSet(req,res,next);
                break;

            case 'principal-URL':
            
                response += "<d:principal-URL><d:href>" + mountedPath.principalPath + "/" + req.user + "/</d:href></d:principal-URL>\r\n";
                break;

            case 'displayname':
                response += "<d:displayname>" + req.user + "</d:displayname>";
                break;

            case 'principal-collection-set':
                response += "<d:principal-collection-set><d:href>" + mountedPath.principalPath +"/</d:href></d:principal-collection-set>";
                break;

            case 'current-user-principal':
                response += "<d:current-user-principal><d:href>" + mountedPath.principalPath + "/" + req.user + "/</d:href></d:current-user-principal>";
                break;

            case 'calendar-home-set':
                response += "<cal:calendar-home-set><d:href>" + mountedPath.calDavPath + "/" + req.user + "</d:href></cal:calendar-home-set>";
                break;

            case 'schedule-outbox-URL':
                response += "<cal:schedule-outbox-URL><d:href>" + mountedPath.calDavPath +"/" + req.user + "/outbox</d:href></cal:schedule-outbox-URL>";
                break;

            case 'calendar-user-address-set':
                response += getCalendarUserAddressSet(req,res,next);
                break;

            case 'notification-URL':
                response += "<cs:notification-URL><d:href>" + mountedPath.calDavPath +"/" + req.user + "/notifications/</d:href></cs:notification-URL>";
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

    res.write("<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">");
    res.write("<d:response>");
    res.write("<d:propstat>");
    res.write("<d:prop>");
    res.write(response);
    res.write("</d:prop>");
    res.write("<d:status>HTTP/1.1 200 OK</d:status>");
    res.write("</d:propstat>");
    res.write("</d:response>");
    res.write("</d:multistatus>");
    res.end();
}

function getSupportedReportSet(req,res,next){
    let response = "";
    response += "        <d:supported-report-set>\r\n";
    response += "        	<d:supported-report>\r\n";
    response += "        		<d:report>\r\n";
    response += "        			<d:expand-property/>\r\n";
    response += "        		</d:report>\r\n";
    response += "        	</d:supported-report>\r\n";
    response += "        	<d:supported-report>\r\n";
    response += "        		<d:report>\r\n";
    response += "        			<d:principal-property-search/>\r\n";
    response += "        		</d:report>\r\n";
    response += "        	</d:supported-report>\r\n";
    response += "        	<d:supported-report>\r\n";
    response += "        		<d:report>\r\n";
    response += "        			<d:principal-search-property-set/>\r\n";
    response += "        		</d:report>\r\n";
    response += "        	</d:supported-report>\r\n";
    response += "        </d:supported-report-set>\r\n";

    return response;
}

function getCalendarUserAddressSet(req){
    let response = "";

    response += "        <cal:calendar-user-address-set>\r\n";
    response += "        	<d:href>mailto:lord test at swordlord.com</d:href>\r\n";
    response += "        	<d:href>" + mountedPath.principalPath + "/" + req.user + "/</d:href>\r\n";
    response += "        </cal:calendar-user-address-set>\r\n";

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
    res.write("<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">\r\n");
    res.write("<d:response>");
    res.write("    <d:href>" + url + "</d:href>");
    res.write("    <d:propstat>");
    res.write("       <d:prop>");
    res.write("           <cs:calendar-proxy-read-for/>");
    res.write("           <cs:calendar-proxy-write-for/>");
    res.write("       </d:prop>");
    res.write("        <d:status>HTTP/1.1 200 OK</d:status>");
    res.write("    </d:propstat>");
    res.write("</d:response>");
    res.write("</d:multistatus>\r\n");
}

function getPrincipalSearchPropertySet(req,res,next){
    let response = "";
    response += "<d:principal-search-property-set xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">\r\n";
    response += "  <d:principal-search-property>\r\n";
    response += "    <d:prop>\r\n";
    response += "      <d:displayname/>\r\n";
    response += "    </d:prop>\r\n";
    response += "    <d:description xml:lang=\"en\">Display name</d:description>\r\n";
    response += "  </d:principal-search-property>\r\n";
//    response += "  <d:principal-search-property>\r\n";
//    response += "    <d:prop>\r\n";
//    response += "      <s:email-address/>\r\n";
//    response += "    </d:prop>\r\n";
//    response += "    <d:description xml:lang=\"en\">Email address</d:description>\r\n";
//    response += "  </d:principal-search-property>\r\n";
    response += "</d:principal-search-property-set>\r\n";

    return response;
}


function handleProppatch(req,res,next){
    log.debug("principal.proppatch called");

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Server", "Caldav");

    let url = req.originalUrl;

    res.write("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
    res.write("<d:multistatus xmlns:d=\"DAV:\" xmlns:cal=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">\r\n");
    res.write("	<d:response>\r\n");
    res.write("		<d:href>" + url + "</d:href>\r\n");
    res.write("		<d:propstat>\r\n");
    res.write("			<d:prop>\r\n");
    res.write("				<cal:default-alarm-vevent-date/>\r\n");
    res.write("			</d:prop>\r\n");
    res.write("			<d:status>HTTP/1.1 403 Forbidden</d:status>\r\n");
    res.write("		</d:propstat>\r\n");
    res.write("	</d:response>\r\n");
    res.write("</d:multistatus>\r\n");

    res.status(200).end();
}

function handleOptions(req,res,next){
    log.debug("principal.options called");

    helper.setStandardHeaders(res);
    helper.setDAVHeaders(res);
    helper.setAllowHeader(res);

    res.status(200).end();
}
