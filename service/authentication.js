import log from '../utils/log'
import { USER } from '../dao/db'

function authentication(username, password, callback) {

    (async function(){
        let user = await USER.find({
            where: { username:username },
        });

        if(!user){
            log.debug(`user not exists, create it`);
            let createdUser = USER.create({
                username:username,
                password:password
            });
            if(!createdUser) {
                log.error(`can't create,too!`);
                callback(false);
            }else{
                callback(true);
            }
        }else{
            if(user.get('password')!=password){
                log.error(`password wrong`);
                callback(false);
            }else{
                callback(true);
            }
        }
    })();

}

module.exports = authentication;