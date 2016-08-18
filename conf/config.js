module.exports = {
    db:{
        databaseType: 'sqlite',
        databaseName: 'caldav',
        databaseFile: 'caldav.db',
        shouldTruncateAllTables: false,
    },
    mountedPath:{
        calDavPath: '/cal',
        principalPath: '/p',
    }
}