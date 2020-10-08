'use strict';

const app = require('./server.js')();
const got = require('got');
const moment = require('moment');

const cache = {};
const city_keys = new Set();

const my_cities = {
    'New York City' : { 'state' : 'New York', 'country' : 'USA'},
    'Los Angeles' : { 'state' : 'California', 'country' : 'USA'},
    'Paris' : { 'state' : 'Ile-de-France', 'country' : 'France'},
    'Istanbul' : { 'state' : 'Istanbul', 'country' : 'Turkey'},
    'Hong Kong' : { 'state' : 'Hong Kong', 'country' : 'Hong Kong'},
    'Delhi' : { 'state' : 'Delhi', 'country' : 'India'},
    'Beijing' : { 'state' : 'Beijing', 'country' : 'China'}
};
// 1. List dataset
app.get('/datasets', function(req, res) {   
    const datasets = [
        {
            id: 'Air Visuals Data',
            name: {en: 'Air Quality for Select Cities'},
            description: {en: 'Real-time air quality data for select cities'},
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
    const state = my_cities[city].state;
    const country = my_cities[city].country;
    let response = await got(`http://api.airvisual.com/v2/city?city=${city}&state=${state}&country=${country}&key=${process.env.API_KEY}`).json();
    if(response !== undefined && response !== null && response.data !== undefined && response.data !== null && response.data.current !== undefined && response.data.current !== null)
        return [city, response.data.current.pollution.ts, response.data.location.coordinates[1], response.data.location.coordinates[0], response.data.current.pollution.aqius, response.data.current.pollution.aqicn];
    else
        throw new Error("mesage request limit");
};

function isCacheStale(id) {
    const curTime = moment();
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
    const details = req.body;
    if (req.headers['x-secret'] !== process.env.CUMULIO_SECRET)
      return res.status(403).end('Given plugin secret does not match Cumul.io plugin secret.');
    
    if(cache[details.id] !== undefined && !isCacheStale(details.id)) {
        return res.status(200).json(cache[details.id].values);
    }
    else {
        createCache(details.id);  
        for(const key in my_cities){
            try {
                let city_data = await getAirQuality(key);
                let city_key = city_data[0] + city_data[1];
                if(!city_keys.has(city_key)) {
                    city_keys.add(city_key);
                    cache[details.id].values.push(city_data);
                }
                cache[details.id].last_update = moment();
            } catch(error) {
                console.error("Reached request limit, will serve from cache");
            }
        }
        return res.status(200).json(cache[details.id].values);
    }
  });