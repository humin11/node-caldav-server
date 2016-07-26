import Sequelize from 'sequelize'
import config from '../conf/db'
import log from '../utils/log'

let sequelize = new Sequelize(config.databaseName, null, null, {
    dialect: config.databaseType,
    logging: log.info,
    storage: config.databaseFile
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

let VCARD = sequelize.define('VCARD', {
    pkey: { type: Sequelize.STRING, allowNull: false, unique: true, primaryKey: true },
    ownerId: { type: Sequelize.STRING, allowNull: false },
    addressbookId: { type: Sequelize.STRING, allowNull: false },
    content: { type: Sequelize.TEXT, allowNull: false },
    is_group: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
});

let ADDRESSBOOK = sequelize.define('ADB', {
    pkey: { type: Sequelize.STRING, allowNull: false, unique: true, primaryKey: true },
    ownerId: { type: Sequelize.STRING, allowNull: false },
    name: { type: Sequelize.STRING, allowNull: false },
    synctoken: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }
});

(async () => {
    try {
        await sequelize.sync();
        log.info("database structure updated")
    } catch (err) {
        log.error("Database structure update crashed: " + error);
    }
})();


module.exports = {
    ICS: ICS,
    CAL: CAL,
    VCARD: VCARD,
    ADB: ADDRESSBOOK,
    sequelize: sequelize
}