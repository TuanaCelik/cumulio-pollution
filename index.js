'use strict';

var app = require('./server.js')();
const { resolve } = require('path');
var request = require('request');   
var air_quality = {};
var tracked_cities = [];
air_quality.tracked_cities = tracked_cities;
var my_cities = {
    "New York" : { "state" : "New York", "country" : "USA"},
    "Paris" : { "state" : "Ile-de-France", "country" : "France"},
    "London" : { "state" : "England", "country" : "UK"},
    "Amsterdam" : { "state" : "North Holland", "country" : "Netherlands"},
    "Leuven" : { "state" : "Flanders", "country" : "Belgium"},
    "Istanbul" : { "state" : "Istanbul", "country" : "Turkey"},
    "Hong Kong" : { "state" : "Hong Kong", "country" : "Hong Kong"}
};
// 1. List dataset
app.get('/datasets', function(req, res) {   
    var datasets = [
        {
            id: "Air Visuals Data",
            name: {en: `Air Quality for Select Cities`},
            description: {en: `Real-time air quality data for select cities`},
            columns: [
                    {id: 'city', name: {en: 'City'}, type: 'hierarchy'},
                    {id: 'update', name: {en: 'Update time'}, type: 'datetime'},
                    {id: 'latitude', name: {en: 'Latitude'}, type: 'numeric'},
                    {id: 'longitude', name: {en: 'Longitude'}, type: 'numeric'},
                    {id: 'aqius', name: {en: 'Air Quality Index (US)'}, type: 'numeric'},
                    {id: 'aqcn', name: {en: 'Air Quality Index (China)'}, type: 'numeric'}
                ]
        }];
    return res.status(200).json(datasets);
});

let getAirQuality = (city, res) => {
    let state = my_cities[city]["state"];
    let country = my_cities[city]["country"];
    return new Promise(
        (resolve, reject) => {
        request.get({
            uri: `http://api.airvisual.com/v2/city?city=${city}&state=${state}&country=${country}&key=${process.env.API_KEY}`,
            gzip: true,
            json: true
        }, function(error, airData) {
            if (error)
                return reject(error);
            console.log(country + " " + state + " " + city);
            console.log(airData.body.data);
            if(typeof airData.body.data.current !== 'undefined') {
                var city_data = [city, airData.body.data.current.pollution.ts, airData.body.data.location.coordinates[1], airData.body.data.location.coordinates[0], airData.body.data.current.pollution.aqius, airData.body.data.current.pollution.aqicn];
                tracked_cities.push(city_data);
            }
            setTimeout(function() {resolve();}, 1500);
        });
    });
};

app.post('/query', function(req, res) {
    if (req.headers['x-secret'] !== process.env.CUMULIO_SECRET)
      return res.status(403).end('Given plugin secret does not match Cumul.io plugin secret.');

    async function get_data(error) {
        if (error)
            return res.status(500).end('Internal Server Error');
        for(var key of Object.keys(my_cities)){
            await getAirQuality(key, res);
        }
        console.log("TRACKED: "  + tracked_cities);
        return res.status(200).json(tracked_cities);
    };
    get_data();
           
  });