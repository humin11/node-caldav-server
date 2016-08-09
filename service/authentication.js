import log from '../utils/log'
import obj from '../dao/db'

function authentication(username, password, callback) {
    log.info(`Login process started for user: ${username}`);

    var USER = obj.USER;



    USER.findOrCreate({ 
        where: { username:username,password:password },
        defaults: { username:username,password:password }, 
    }).spread(function(user, created) {
        if(!user) {
            log.error(`can't find user and can't create!`);
            callback(false);
        }else{
            callback(true);
        }
    }).catch(function(err){
        log.error(err);
        callback(false);
    });


}

module.exports = authentication;