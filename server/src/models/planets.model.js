const { parse } = require("csv-parse");
const fs = require("fs");
const { resolve } = require("path");

const planets = require("./planets.mongo");

// const habitablePlanets = [];

function isHabitablePlanet(planet) {
  // fn to filter out inhabitable pla nets
  return (
    planet["koi_disposition"] === "CONFIRMED" &&
    planet["koi_insol"] > 0.36 &&
    planet["koi_insol"] < 1.11 &&
    planet["koi_prad"] < 1.6
  );
}

async function loadPlanetsData() {
  // return new Promise((resolve, reject) => {
  fs.createReadStream("kepler.csv")
    .pipe(
      parse({
        comment: "#",
        columns: true,
      })
    )
    .on("data", async (data) => {
      if (isHabitablePlanet(data)) {
        // habitablePlanets.push(data);
        savePlanet(data);
      }
    })
    .on("error", (err) => {
      console.log(err);
      reject(err);
    })
    .on("end", async () => {
      const planetCount = (await getAllPlanets()).length;
      console.log(`${planetCount} habitable planets were found `);
      resolve();
    });
  // });
}

async function getAllPlanets() {
  // return habitablePlanets;
  return await planets.find({}, { _id: 0, __v: 0 });
  // we dont want to return the _id and __v fields so we exclude them by setting them to 0
}

async function savePlanet(planet) {
  try {
    // insert + update = upsert
    await planets.updateOne(
      {
        keplerName: planet.kepler_name,
        // this is the filter part of the upsert that is we are finding if this planet already exists
      },
      {
        keplerName: planet.kepler_name,
        // this is the data to be inserted if the planet does not already exist
        // also if it exists it will be updated with this data
        // if upsert was false then it would only update the existing data and not insert new data i.e if it does not exist it will do nothing
      },
      {
        upsert: true,
        // this option will insert the data if it does not already exist
      }
    );
  } catch (err) {
    console.error(`Could not save planet ${err}`);
  }
}

module.exports = {
  loadPlanetsData,
  // server will call this every instance of the server and thus duplicating the data so we will have to use upsert in the loadPlanetsData function so that it insert only if the data is not already present
  getAllPlanets,
};
