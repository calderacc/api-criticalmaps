var mysqlConnectionPool = require('../api-commons/connectionPool.js').mysqlConnectionPool;
var request = require("request");
var fs = require('fs');

var configFile = fs.readFileSync('../api-commons/config.json');
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

/**
 * This function converts coordinates provided by critical maps.
 *
 * It is stolen from: https://github.com/criticalmaps/criticalmaps-web/blob/master/src/js/app/utils.js
 *
 * @author maltehuebner
 * @since 2015-01-25
 * @see https://github.com/criticalmaps/criticalmaps-web/blob/master/src/js/app/utils.js
 * @param oldFormat
 * @returns {string}
 */
function convertCoordinateFormat(oldFormat) {
    var chars = oldFormat.split( '' );

    chars.splice(-6, 0, '.');

    return chars.join('');
}

/**
 * After each api query this function handles processing of the results.
 *
 * It basically goes through all location structures and calls processLocation on those entities.
 *
 * @author maltehuebner
 * @since 2015-01-25
 * @param error
 * @param response
 * @param body
 */
function processResult(error, response, body) {
    if (body) {
        var data  = null;

        try {
            data = JSON.parse(body);
        } catch(err) {
            console.log('Could not parse JSON. Maybe the server has a error page online?')
        }

        if (data != null) {
            var locations = data.locations;

            for (var identifier in locations) {
                processLocation(identifier, locations[identifier]);
            }
        }
    }
}

/**
 * Each location construct will be handled by this function.
 *
 * This function looks up the identifier in the databse. If it is not found, a new identifier entity will be created.
 *
 * Afterwards the location data is also saved in the database.
 *
 * @author maltehuebner
 * @since 2015-01-25
 * @param identifier
 * @param location
 */
function processLocation(identifier, location) {
    var queryString = 'SELECT * FROM criticalmaps_user WHERE identifier = \'' + identifier + '\';';

    runDatabaseQuery(queryString, function(rows) {
        if (rows.length == 0) {
            createIdentifier(identifier, location)
        } else {
            updateIdentifier(identifier, location);
        }
    });
}

/**
 * Creates a new identifier in the database.
 *
 * This method sets up a new criticalmaps_user entity in the criticalmass database. It will setup a color and some dattime
 * stuff for this identifier.
 *
 * @author maltehuebner
 * @since 2015-01-25
 * @param identifier
 * @param location
 */
function createIdentifier(identifier, location) {
    var colorRed = Math.round(Math.random() * 255);
    var colorGreen = Math.round(Math.random() * 255);
    var colorBlue = Math.round(Math.random() * 255);

    var queryString = 'INSERT INTO criticalmaps_user SET identifier = \'' + identifier + '\', creationDateTime = NOW(), startDateTime = NOW(), endDateTime = NOW(), colorRed = ' + colorRed + ', colorGreen = ' + colorGreen + ', colorBlue = ' + colorBlue + ';';

    console.log('Creating identifier ' + identifier);

    runDatabaseQuery(queryString, function() {
        savePosition(identifier, location);
    });
}

/**
 * Updates the identifier entity in the database.
 *
 * At this time, only the endDateTime field will be updated to the current timestamp.
 *
 * @author maltehuebner
 * @since 2015-01-25
 * @param identifier
 * @param location
 */
function updateIdentifier(identifier, location) {
    var queryString = 'UPDATE criticalmaps_user SET endDateTime = NOW() WHERE identifier = \'' + identifier + '\';';

    runDatabaseQuery(queryString, function() {
        savePosition(identifier, location);
    });
}

/**
 * Saves the location data into our database.
 *
 * @author maltehuebner
 * @since 2015-01-25
 * @param identifier
 * @param location
 */
function savePosition(identifier, location) {
    var latitude = convertCoordinateFormat(location.latitude);
    var longitude = convertCoordinateFormat(location.longitude);
    var dateTime = new Date(location.timestamp * 1000);
    var dateTimeString = dateTime.getFullYear() + '-' + (dateTime.getMonth() + 1) + '-' + dateTime.getDate() + ' ' + dateTime.getHours() + '-' + dateTime.getMinutes() + '-' + dateTime.getSeconds();

    console.log('Saving identifier ' + identifier + ' [' + latitude + ', ' + longitude + ']');

    var queryString  = 'INSERT INTO position SET criticalmaps_user = (';
        queryString += 'SELECT id FROM criticalmaps_user WHERE identifier = \'' + identifier + '\'';
        queryString += '), ride_id = (';
        // yeah, right, double SQRT(…) is evil, but SQL does not support "virtual columns" in where clauses
        queryString += 'SELECT id FROM ride WHERE SQRT(POW(ride.latitude - ' + latitude + ', 2) + POW(ride.longitude - ' + longitude +', 2)) < 0.3 AND isArchived = 0 AND hasLocation = 1 AND DATE(dateTime) = DATE(\'' + dateTimeString + '\') ORDER BY SQRT(POW(ride.latitude - ' + latitude + ', 2) + POW(ride.longitude - ' + longitude +', 2)) ASC LIMIT 1';
        queryString += '), latitude = ' + latitude + ', longitude = ' + longitude + ', timestamp = UNIX_TIMESTAMP(\'' + dateTimeString + '\'), creationDateTime = \'' + dateTimeString + '\';';

    console.log(queryString);
    runDatabaseQuery(queryString, function() {});
}

/**
 * Starts a query for the latest position data and pass them to processResult().
 *
 * @author maltehuebner
 * @since 2015-01-25
 */
function fetchPositions() {
    console.log('Querying Critical Maps Api');

    get(config.criticalmaps.baseUrl, processResult);
}

/**
 * Starts the callback for processing location data from critical maps.
 *
 * @author maltehuebner
 * @since 2015-01-25
 */
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
