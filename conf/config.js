module.exports = {
    db:{
        databaseType: 'sqlite',
        databaseName: 'caldav',
        databaseFile: 'caldav.db',
        shouldTruncateAllTables: true,
    },
    mountedPath:{
        calDavPath: '/cal',
        principalPath: '/p',
    }
}