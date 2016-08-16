import log from '../utils/log'
import { USER } from '../dao/db'

function authentication(username, password, callback) {

    (async function(){
        try{
            let [user,created] = await USER.findOrCreate({ 
                where: { username:username,password:password },
                defaults: { username:username,password:password }, 
            });

            if(!user) {
                log.error(`can't find user and can't create!`);
                callback(false);
            }else{
                callback(true);
            }
        }catch(err){
            log.error(`connect to USER failed`);
            callback(false);
        }
    })();

}

module.exports = authentication;