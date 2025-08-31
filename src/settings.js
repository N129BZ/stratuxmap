const settings = {
    startupzoom: 5,
    useOSMonlinemap: true,
    debug: false,
    uselocaltime: true,
    distanceunit: "sm",
    usestratux: true,
    stratuxip: "localhost",
    httpport: 8500,
    savepositionhistory: false,
    histintervalmsec: 10000,
    historyDb: "positionhistory.db",
    gpsintervalmsec: 1000,
    stratuxsituationws: "ws://[stratuxip]/situation",
    stratuxtrafficws: "ws://[stratuxip]/traffic",
    stratuxweatherws: "ws://[stratuxip]",
    animatedwxurl: "https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r-t.cgi",
    addswxurl: "https://aviationweather.gov/api/data/###?&format=xml&hours=1.5",
    addscurrentxmlurl: "https://aviationweather.gov/data/cache/###.cache.xml",
    showattribution: true,
    lockownshiptocenter: true,
    ownshipimage: "airplane.png",
    trafficimage: "red-yellow-traffic.png",
    usemetricunits: false,
    distanceunits: {
        kilometers: "km",
        nauticalmiles: "nm",
        statutemiles: "sm"
    },
};

export default settings;