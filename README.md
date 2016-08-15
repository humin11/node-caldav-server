# node-caldav-server
This is a caldav server written by express.js with babel

## Features
- much faster than radicale
- support multiple users with sqlite database
- offer addition APIs for microservice 
- friendly with developer because of ES6 features thanks to babel
- detailed documents for both deployment and use

## Deployment
node-caldav-server relys on node-gyp, which does not work perfect on Windows

Therefore, *nux is the best deployment env.

```
npm install
npm start
```

The server is running at localhost:3000

## Usage
node-caldav-server is still in developing. 

After developing, we will test caldav client as many as we can.

### caldav client
- [x] Mozilla Lightning
- [x] SOL Calendar
- [ ] IPHONE & IPAD Calendars
- [ ] OSX Calendars
- [ ] CalendarSync
- [ ] ContactSync
- [ ] Caldav-Sync
- [ ] DAVdroid
- [ ] ACAL

If you want to try now, see the 

### Mozilla Lightning
Mozilla Lightning

- start Lightning
    - click on File and New Calendar
- first window
    - choose a calendar On the Network
- next window
    - choose protocol as CalDAV
    - location: localhost:3000/cal/:user_name/:calendar_name?
        - please replace the `:user_name` with your own name
        - `calendar_name` is optional. If not provided, node-caldav-server will use username as `calendar_name`
        - Example: localhost:3000/cal/demo/demo or localhost:3000/cal/demo
    - disable the offline support
- final window
    - you can set whatever you want , since settings of final window is only used by Mozzila Lightning rather than caldav server.

You can now add events and tasks to your calendar. 

### SOL Calendar
SOL Calendar is an Android app
- open Settings
- click on Add other calendar account
- click on Custom
- Upcoming window
    - location: localhost:3000/cal/:user_name/:calendar_name?
        - please replace the `:user_name` with your own name
        - `calendar_name` is optional. If not provided, node-caldav-server will use username as `calendar_name`
        - Example: localhost:3000/cal/demo/demo or localhost:3000/cal/demo
        - WARNING: if your server isn't support HTTPS, remember replace `https://` with `http://` 
    - username, please fill in the name which is equls to the URL `user_name`
    - password, you can fill in whatever you want