import log from '../utils/log'
import { USER } from '../dao/db'

function authentication(username, password, callback) {
    log.info(`Login process started for user: ${username}`);
    log.info(`USER: ${USER}`);

    USER.findOrCreate({ 
        where: { username:username,password:password },
        defaults: { username:username,password:password }, 
    }).spread(function(user, created) {
        if(!user) {
            callback(false);
        }else{
            log.info(user.get({
                plain: true
            }));
            log.info(`created: ${created}`);
            callback(true);
        }
    }).catch(function(err){
        log.error(err);
        callback(false);
    });


}

module.exports = authentication;