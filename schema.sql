DROP TABLE IF EXISTS location;

CREATE TABLE location(
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(255),
  formatted_query VARCHAR(255),
  latitude DECIMAL(18, 15),
  longitude DECIMAL(18, 15)

);



-- syntax: (at terminal) psql -d <DB Name> -f <Filename>
-- psql -d city_explorer -f schema.sql