export default {
    setStandardHeaders: function(res){
        res.set("Content-Type", "application/xml; charset=utf-8");
        res.set("Server", "Caldav");
    },
    setDAVHeaders: function(res){
        res.setHeader("DAV", "1, 3, extended-mkcol, calendar-access, calendar-schedule, calendar-proxy, calendarserver-sharing, calendarserver-subscribed, addressbook, access-control, calendarserver-principal-property-search");
    },
    setAllowHeader: function(res){
        res.setHeader("Allow", "OPTIONS, PROPFIND, HEAD, GET, REPORT, PROPPATCH, PUT, DELETE, POST, COPY, MOVE");
    },
    getXMLHead: function(){
        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n\r";
    },
    stringEndsWith: function(str,suffix){
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }

}