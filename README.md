# Critical Maps Gateway

## About Critical Maps

Critical Maps is an online service for providing geolocation data for critical mass rides. They run a web site to display the current position of critical mass rides at a leaflet-driven map and offer an smartphone app for iOS and Android to send the user’s current location to their server.

Visit their website at [criticalmaps.net](http://www.criticalmaps.net/), the [iOS](http://sqi.be/criticalmapsios) and the [Android](http://sqi.be/criticalmapsandroid) app. And yes: They publish their stuff at [GitHub](https://github.com/criticalmaps)!

## Geolocation service

As the Critical Maps API is open for own usage, the criticalmass.in-app will also display the Critical Maps Geolocation data at it’s own maps. This small node.js-driven service will call the Critical Maps API, catch the latest geolocation data and throw it into the criticalmass.in database.

## Depedencies

This service relays on [calderacc/api-commons](https://github.com/calderacc/api-commons).