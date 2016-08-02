import Sequelize from 'sequelize'
import config from '../conf/db'
import log from '../utils/log'

let sequelize = new Sequelize(config.databaseName, null, null, {
    dialect: config.databaseType,
    logging: function(info){
        if(info)
            log.info(info);
        else
            log.info("Not catch info");
    },
    storage: config.databaseFile
});

let USER = sequelize.define('USER', {
    username: {type: Sequelize.STRING,allowNull: false},
    password: {type: Sequelize.STRING,allowNull: false,}
});

let ICS = sequelize.define('ICS', {
    pkey: {type: Sequelize.STRING, allowNull: false, unique: true, primaryKey: true,},
    calendarID: {type: Sequelize.STRING,allowNull: false},
    content: {type: Sequelize.TEXT,allowNull: false,}
});

let CAL = sequelize.define('CAL', {
    pkey: { type: Sequelize.STRING, allowNull: false, unique: true, primaryKey: true },
    owner: { type: Sequelize.STRING, allowNull: false },
    timezone: { type: Sequelize.TEXT, allowNull: false },
    order: { type: Sequelize.STRING, allowNull: false },
    free_busy_set: { type: Sequelize.STRING, allowNull: false },
    supported_cal_component: { type: Sequelize.STRING, allowNull: false },
    colour: { type: Sequelize.STRING, allowNull: false },
    displayname: { type: Sequelize.STRING, allowNull: false },
    synctoken: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }
});

(async () => {
    try {
        await sequelize.sync({ 
            // force: true 
        });
        log.info("database structure updated")
    } catch (err) {
        log.error("Database structure update crashed: " + error);
    }
})();


module.exports = {
    USER: USER,
    ICS: ICS,
    CAL: CAL,
    sequelize: sequelize
}