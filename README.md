# cumulio-pollution
Cumul.io plugin for Air Quality Data

This repository accompanies the [link to tutorial].
I use the [AirVisal API](https://www.iqair.com/air-pollution-data-api) (Comunity Version) to create a Cumul.io plugin

To run:
1. Start [ngork](https://ngrok.com/) on port 3030 and copy link
2. Create a plugin on your Cumul.io profile
3. Add the URL created by ngrok to Base URL & authentication
4. `npm install`
5. Create a file called '.env' in the root directory. Here, fill the API_KEY with the key you create with AirVisual API, and CUMULIO_SECRET with the App Secret that is created when you create the plugin on Cumul.io:
`API_KEY=XXX`
`CUMULIO_SECRET=XXX`
`PORT=3030`
6. `npm run start` or `node index.js` 