'use strict';

var app = require('./server.js')();
const { resolve } = require('path');
const got = require('got');
var moment = require('moment');
const { default: create } = require('got/dist/source/create');

const cache = {};
var city_keys = new Set();

var my_cities = {
    "New York City" : { "state" : "New York", "country" : "USA"},
    "Los Angeles" : { "state" : "California", "country" : "USA"},
    "Paris" : { "state" : "Ile-de-France", "country" : "France"},
    "Istanbul" : { "state" : "Istanbul", "country" : "Turkey"},
    "Hong Kong" : { "state" : "Hong Kong", "country" : "Hong Kong"},
    "Delhi" : { "state" : "Delhi", "country" : "India"},
    "Beijing" : { "state" : "Beijing", "country" : "China"}
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

async function getAirQuality(city) {
    let state = my_cities[city].state;
    let country = my_cities[city].country;
    try {
        let response = await got(`http://api.airvisual.com/v2/city?city=${city}&state=${state}&country=${country}&key=${process.env.API_KEY}`).json();
        if(response !== undefined && response !== null && response.data !== undefined && response.data !== null && response.data.current !== undefined && response.data.current !== null)
            return [city, response.data.current.pollution.ts, response.data.location.coordinates[1], response.data.location.coordinates[0], response.data.current.pollution.aqius, response.data.current.pollution.aqicn];
    }
    catch(error) {
        console.log(error.response.body);
    }
};

function isCacheStale(id) {
    var curTime = moment();
    return curTime.diff(cache[id].last_update, 'hours') >= 24;
}

function createCache(id) {
    if(!cache[id])
    {
        cache[id] = {
            values : [],
            last_update : null
        }
    }
}

app.post('/query', async function(req, res) {
    let details = req.body;
    if (req.headers['x-secret'] !== process.env.CUMULIO_SECRET)
      return res.status(403).end('Given plugin secret does not match Cumul.io plugin secret.');
    
    if(cache[details.id] !== undefined && !isCacheStale(details.id)) {
        return res.status(200).json(cache[details.id].values);
    }
    else {
        createCache(details.id);   
        for(var key of Object.keys(my_cities)){
            let city_data = await getAirQuality(key);
            if(city_data !== undefined && city_data.length > 0){
                let city_key = city_data[0] + city_data[1];
                if(!city_keys.has(city_key)) {
                    city_keys.add(city_key);
                    cache[details.id].values.push(city_data);
                }
                cache[details.id].last_update = moment();
            }
        }
        return res.status(200).json(cache[details.id].values);  
    }

  });