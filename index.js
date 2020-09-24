'use strict';

var app = require('./server.js')();
const { resolve } = require('path');
var request = require('request');   
var air_quality = {};
var tracked_cities = [];
air_quality.tracked_cities = tracked_cities;

// 1. List dataset
app.get('/datasets', function(req, res) {   

    if (req.headers['x-secret'] !== process.env.CUMULIO_SECRET)
        return res.status(403).end('Given plugin secret does not match Cumul.io plugin secret.');
    
    request.get({
        uri: `http://api.airvisual.com/v2/countries?key=${process.env.API_KEY}`,
        gzip: true,
        json: true
        }, function(error, countries) {
        if (error)
            return res.status(500).end('Internal Server Error');
        var datasets = countries.body.data.map(function(country) {
            return {
            id: country.country,
            name: {en: `Air Quality for ${country.country}`},
            description: {en: `Real-timeair quality data for ${country.country}`},
            columns: [
                {id: 'city', name: {en: 'City'}, type: 'hierarchy'},
                {id: 'last_update', name: {en: 'Last update'}, type: 'datetime'},
                {id: 'latitude', name: {en: 'Latitude'}, type: 'numeric'},
                {id: 'longitude', name: {en: 'Longitude'}, type: 'numeric'},
                {id: 'aqius', name: {en: 'Air Quality Index (US)'}, type: 'numeric'},
                {id: 'aqcn', name: {en: 'Air Quality Index (China)'}, type: 'numeric'}
            ]
            }
        });
        return res.status(200).json(datasets);
        });
});

let getCities = (country, state, res) => {
    return new Promise(
        (resolve, reject) => {
        request.get({
            uri: `http://api.airvisual.com/v2/cities?state=${state}&country=${country}&key=${process.env.API_KEY}`,
            gzip: true,
            json: true
        }, function(error, cities) {
            if (error)
                return reject(error);
            
            console.log(cities.body.data);
            var available_cities = cities.body.data.map(function(city) {
                return city.city;
            });

            var resolved_data = available_cities.map(function(city) {
                return getAirQuality(country, state, city, res);
            });
            Promise.all(resolved_data).then(() => {
                resolve();
            });
        });
    });
};

let getAirQuality = (country, state, city, res) => {
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
            console.log(airData.body.data.current);
            var city_data = [city, airData.body.data.current.pollution.ts, airData.body.data.location.coordinates[0], airData.body.data.location.coordinates[1], airData.body.data.current.pollution.aqius, airData.body.data.current.pollution.aqicn];
            tracked_cities.push(city_data);
            resolve();
        });
    });
};

app.post('/query', function(req, res) {
    if (req.headers['x-secret'] !== process.env.CUMULIO_SECRET)
      return res.status(403).end('Given plugin secret does not match Cumul.io plugin secret.');

    var country = req.body.id;
    request.get({
        uri: `http://api.airvisual.com/v2/states?country=${country}&key=${process.env.API_KEY}`,
        gzip: true,
        json: true
    }, function(error, states) {
        if (error)
            return res.status(500).end('Internal Server Error');
        
        var states = states.body.data.map(function(state){
            return state.state;
        });

        let getTrackedCityData = (states) => {
            return new Promise(
                (resolve, reject) => {
                    if(error) reject(error);
                    var resolved_cities = states.map(function(state) {
                      //console.log(state.state);
                       return getCities(country, state, res);
                    });
                    Promise.all(resolved_cities).then(() => {
                        resolve(tracked_cities);
                    });
                }
            )
        }

        getTrackedCityData(states).then(
            tracked_cities => res.status(200).json(tracked_cities)
        ).catch(
            error => console.log(error)
        );
    });
  });