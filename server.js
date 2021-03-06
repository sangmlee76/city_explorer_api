'use strict';

//=========== Load Packages ==========//
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const superagent = require('superagent');
const pg = require('pg');

//===== Setup Application (Server) ====//
const app = express();
app.use(cors());

const DATABASE_URL = process.env.DATABASE_URL;
const client = new pg.Client(DATABASE_URL);
client.on('error', (error) => console.log(error));

//======== Global Variables ==========//
const PORT = process.env.PORT || 3111;


//========== Setup Routes ============//

//--Routes--//
app.get('/location', getGpsCoordinates);
app.get('/weather', getWeather);
app.get('/parks', getParks);
app.get('/movies', getMovies);
app.get('/yelp', getRestaurants);

//--Route Callback: 'front-end link'--//
//This code block is Stephen's great idea to keep front-end link nearby (obtained with permission during code review)
app.get('/', (request, response) => {
  response.send('Frontend here --> https://codefellows.github.io/code-301-guide/curriculum/city-explorer-app/front-end/');
});

//--Route Callback: '/location'--//
function getGpsCoordinates(req, res) {
  console.log('I HAVE ENTERED THE GET GPS FUNCTION')
  const searchedCity = req.query.city; //req.query is the way we get data from the front-end.
  // console.log(searchedCity);
  const locationApiKey = process.env.GEOCODE_API_KEY;

  const sqlQuery = 'SELECT * FROM location WHERE search_query=$1'; //$1 is expecting an array to be passed in to know what to replace the $x with. Index 0 = $1 -- order matters!
  const sqlArray = [searchedCity];

  client.query(sqlQuery, sqlArray) //
    .then(result => {
      // console.log('result.rows', result.rows);

      if (result.rows.length !== 0) {
        console.log('It exists already');
        res.send(result.rows[0]);
      } else {
        console.log('Created using superagent');
        if (req.query.city === '') {
          res.status(500).send('Sorry, please enter a valid U.S. city');
          return;
        }

        const url = `https://us1.locationiq.com/v1/search.php?key=${locationApiKey}&q=${searchedCity}&format=json`;

        superagent.get(url)
          .then(result => {
            const dataObjFromJson = result.body[0]; //TODO: see video to see where .body comes from --> @ 3:40. Based on documentation (http://expressjs.com/en/api.html and http://expressjs.com/en/resources/middleware/body-parser.html), it seems like this is a method that is part of a built-in function, called body-parser, from express.
            const newLocation = new Location(
              searchedCity,
              dataObjFromJson.display_name,
              dataObjFromJson.lat,
              dataObjFromJson.lon
            );
            // saves each query data into the database in the table
            const sqlQuery = 'INSERT INTO location (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4)'; // this just builds a "template" of the query so pg knows which table columns to bring in the data

            const sqlArray = [newLocation.search_query, newLocation.formatted_query, newLocation.latitude, newLocation.longitude]; //this is the data that we need to get from the API to populate the database in the condition (e.g. from the "if" above) where this data (query result) doesn't already  exist.

            client.query(sqlQuery, sqlArray); //this code executes the database update - think of this as mustache. You are taking a template and a values array (it MUST be an array for SQL DBs) in order to execute the update.

            res.send(newLocation);
          })
          .catch(error => {
            res.status(500).send('LocationIQ failed');
            console.log(error.message);
          });
      }

    });


}

//--Route Callback: '/weather'--//
function getWeather(req, res) {
  const searchedCity = req.query.search_query;
  // console.log('*********** CITY*************' , searchedCity);
  const weatherApiKey = process.env.WEATHER_API_KEY;
  const latitude = req.query.latitude;
  const longitude = req.query.longitude;
  const url = `https://api.weatherbit.io/v2.0/forecast/daily?days=8&city=${searchedCity}&country=US&key=${weatherApiKey}`;

  superagent.get(url)
    .then(result => {
      // console.log(result.body);
      const arr = result.body.data.map(weatherObject => new Weather(weatherObject));  // RECALL: a single line arrow function has an implied 'return'
      res.send(arr);
    })
    .catch(error => {
      res.status(500).send('Weatherbit failed');
      console.log(error.message);
    });
}

//--Route Callback: '/parks'--//
function getParks(req, res) {
  const searchedCity = req.query.search_query;
  // console.log('********** CITY ***********', searchedCity);
  const parksApiKey = process.env.PARKS_API_KEY;
  const url = `https://developer.nps.gov/api/v1/parks?q=${searchedCity}&api_key=${parksApiKey}&limit=10`;

  superagent.get(url)
    .then(result => {
      // console.log(result.body);
      const arr = result.body.data.map(parkObject => new Park(parkObject));
      res.send(arr);
    })
    .catch(error => {
      res.status(500).send('National Parks failed');
      console.log(error.message);
    });
}

//--Route Callback: '/movie'--//
function getMovies(req, res) {
  const searchedCity = req.query.search_query;
  // console.log('*************CITY**********', searchedCity);
  const moviesApiKey = process.env.MOVIE_API_KEY;
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${moviesApiKey}&language=en-US&query=${searchedCity}`;

  superagent.get(url)
    .then(result => {
      // console.log(result.body);
      const arr = result.body.results.map(movieObject => new Movie(movieObject));
      res.send(arr);
    })
    .catch(error => {
      res.status(500).send('MovieDB failed');
      console.log(error.message);
    });

}


//--Route Calback: '/yelp'--//
function getRestaurants(req, res) {
  const searchedCity = req.query.search_query;
  // console.log('************CITY**************', searchedCity)
  const page = req.query.page;
  const offset = (page-1)*5;
  const yelpApiKey = process.env.YELP_API_KEY;
  const url = `https://api.yelp.com/v3/businesses/search?term=restaurants&location=${searchedCity}&locale=en_US&limit=5&offset=${offset}`;

  superagent.get(url)
    .set('Authorization', `Bearer ${yelpApiKey}`)
    .then(result => {
      // console.log(result.body);
      const arr = result.body.businesses.map(restaurantObject => new Restaurant(restaurantObject));
      // console.log(arr);
      res.send(arr);
    })
    .catch(error => {
      res.status(500).send('Yelp failed');
      console.log(error.message);
    });

}



//========= Helper Functions =========//
//Constructor goes here//

function Location(search_query, formatted_query, latitude, longitude) {
  this.search_query = search_query;
  this.formatted_query = formatted_query; // this is what the front-end is calling the type of data they are looking for -- the query that is being passed in is being formatted and has been assigned as "formatted_query" -- this means that if the front-end calls this something else, then we will change this accordingly.
  this.longitude = longitude;
  this.latitude = latitude;
  //TODO: update this constructor to look like /weather and /parks
}

function Weather(weatherObject) {
  this.forecast = weatherObject.weather.description;
  this.time = weatherObject.valid_date;
}

function Park(parkObject) {
  // console.log('****************', parkObject); //KEY: this is how you check for debugging if you are getting the data in results.body
  this.name = parkObject.fullName;
  this.address = `${parkObject.addresses[0].line1}, ${parkObject.addresses[0].city}, ${parkObject.addresses[0].stateCode}, ${parkObject.addresses[0].postalCode}`;
  this.fee = parkObject.entranceFees[0].cost;
  this.description = parkObject.description;
  this.url = parkObject.url;
}

function Movie(movieObject) {
  // console.log(movieObject);
  const moviePosterName = movieObject.poster_path; //poster's 'file_path' (e.g. name) exists as one of the returned keys from the API; it is the *name* of the poster that we want to get.
  const moviePosterImageUrl = `https://image.tmdb.org/t/p/w500/${moviePosterName}`; // using this base url provided from moviedb documentation (ref: https://developers.themoviedb.org/4/getting-started/images), we replace the poster name associated with each movie into the Url to complete the Url. This is needed to call the "/configuration API" to get the actual image file that we need from the image API.
  this.title = movieObject.title;
  this.overview = movieObject.overview;
  this.average_votes = movieObject.vote_average;
  this.total_votes = movieObject.vote_count;
  this.image_url = moviePosterImageUrl; //this will allow us to build the image for each poster with each instantiation of a Movie through the contructor function. This then will be passed back to the front end since they will be looking for the "image_url" key (this was defined as part of the dev requirement -- Trello-Lab9-Task1)
  this.popularity = movieObject.popularity;
  this.released_on = movieObject.release_date;
}

function Restaurant(restaurantObject) {
  //console.log(restaurantObject);
  this.name = restaurantObject.name;
  this.image_url = restaurantObject.image_url;
  this.price = restaurantObject.price;
  this.rating = restaurantObject.rating;
  this.url = restaurantObject.url
}

//=========== Start Server ===========//
client.connect()
  .then(() => {
    app.listen(PORT, () => console.log(`we are up on PORT ${PORT}`))
  }).catch(err => console.error(err));




/////////// PG SQL Set-up Steps ///////
// 1. create db
// 2. add pg, the package
// 3. create the client variable and pass it the DATABASE_URL
// 4. connect to the db
// 5. add to our route a check for if there is data in the db
// 6. create the table
// 7. create a schema.sql file
// 8. run the schema.sql file with psql -d city_explorer -f schema.sql (this connects the front-end to the server to the db --> TODO: validate this)
// 9. add to our route a check for if there is data in the db
// 10. check the table for the location

/////////// Key console.logs for debugging ///////////////
// 1. console.log(req.query) related to to see the data coming from the front end
// 2. console.log(result.body) following superagent call, after the .then(), to see the data coming back from the API
// 3. console.log(result.row) following client.query (for pgsql), to check the value of the SQL table row to see if it has data or is empty (depending on what you are trying to accomplish)
// 4. console.log(error.message) for sending an error message to terminal, following .catch(), can use other error prompt/string that you want to provide for clarity. TODO: the one for the start server is not working in my current code
// 5. consle.log(<reponseArray>) to check the data that is going to be sent back to the front end, place it before the res.send(<responseArray>).
// 6. console.log(<nameOfParameter>) inside the constructor function to pass in the obj data to see what is being pulled in from the API, this is similar to result.body but used to troubleshoot how far the data is getting once retrieved (e.g. is it making it through the constructor or not) -- this is another best way to get fully detailed API results to see json data structure.