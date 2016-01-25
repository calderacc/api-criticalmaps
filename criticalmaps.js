var mysqlConnectionPool = require('../api-commons/connectionPool.js').mysqlConnectionPool;
var request = require("request");
var fs = require('fs');

var configFile = fs.readFileSync('../api-commons/config.js');
var config;

try {
    config = JSON.parse(configFile);
} catch (err) {
    console.log('There has been an error parsing your JSON.');
    console.log(err);
}

function get(url, callback, data) {
    request({
        uri: url,
        method: "GET",
        timeout: 10000,
        followRedirect: true,
        maxRedirects: 10
    }, callback);
}

function post(url, callback, data) {
    request({
        uri: url,
        method: "POST",
        form: data
    },
    callback);
}

function convertCoordinateFormat(oldFormat) {
    var chars = oldFormat.split( '' );

    chars.splice(-6, 0, '.');

    return chars.join('');
}

function processResult(error, response, body) {
    if (body) {
        var data = JSON.parse(body);

        if (data != null) {
            var locations = data.locations;

            for (var identifier in locations) {
                processLocation(identifier, locations[identifier]);
            }
        }
    }
}

function processLocation(identifier, location) {
    var queryString = 'SELECT * FROM criticalmaps_user WHERE identifier = \'' + identifier + '\';';

    runDatabaseQuery(queryString, function(rows) {
        if (rows.length == 0) {
            createIdentifier(identifier)
        } else {
            updateIdentifier(identifier);
        }
    });

    savePosition(identifier, location);
}

function createIdentifier(identifier) {
    var colorRed = Math.round(Math.random() * 255);
    var colorGreen = Math.round(Math.random() * 255);
    var colorBlue = Math.round(Math.random() * 255);

    var queryString = 'INSERT INTO criticalmaps_user SET identifier = \'' + identifier + '\', creationDateTime = NOW(), startDateTime = NOW(), endDateTime = NOW(), colorRed = ' + colorRed + ', colorGreen = ' + colorGreen + ', colorBlue = ' + colorBlue + ';';

    runDatabaseQuery(queryString, function() {});
}

function updateIdentifier(identifier) {
    var queryString = 'UPDATE criticalmaps_user SET endDateTime = NOW() WHERE identifier = \'' + identifier + '\';';

    runDatabaseQuery(queryString, function() {});
}

function savePosition(identifier, location) {
    var latitude = convertCoordinateFormat(location.latitude);
    var longitude = convertCoordinateFormat(location.longitude);
    var dateTime = new Date(location.timestamp * 1000);
    var dateTimeString = dateTime.getFullYear() + '-' + (dateTime.getMonth() + 1) + '-' + dateTime.getDate() + ' ' + dateTime.getHours() + '-' + dateTime.getMinutes() + '-' + dateTime.getSeconds();

    var queryString = 'INSERT INTO position SET criticalmaps_user = (SELECT id FROM criticalmaps_user WHERE identifier = \'' + identifier + '\'), latitude = ' + latitude + ', longitude = ' + longitude + ', creationDateTime = \'' + dateTimeString + '\';';

    runDatabaseQuery(queryString, function() {});
}

function fetchPositions() {
    get(config.criticalmaps.baseUrl, processResult);
}

function startFetchCallback() {
    fetchPositions();

    setInterval(fetchPositions, config.criticalmaps.interval);
}

function runDatabaseQuery(queryString, callbackFunction) {
    mysqlConnectionPool.getConnection(function(err, connection) {
        connection.query('USE ' + config.database.dbname + ';', function(err, rows) {
            connection.query(queryString, function(err, rows) {
                connection.release();

                callbackFunction(rows);
            });
        });
    });
}

startFetchCallback();