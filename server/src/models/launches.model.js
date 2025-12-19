const axios = require("axios");

const launchesDB = require("./launches.mongo");
const planets = require("./planets.mongo");

// const { response } = require("../app");

const DEFAULT_FLIGHT_NUMBER = 100;

const SPACEX_API_URL = "https://api.spacexdata.com/v5/launches/query";
// const launches = new Map(); //this is a state

// let latestflightNumber = 100; //2nd state

async function populateLaunches() {
  console.log("downloading launch data...");
  const response = await axios.post(SPACEX_API_URL, {
    query: {},
    options: {
      pagination: false,
      populate: [
        {
          path: "rocket",
          select: {
            name: 1,
          },
        },
        {
          path: "payloads",
          select: {
            customers: 1,
          },
        },
      ],
    },
  });

  if (response.status !== 200) {
    console.log("Problem downloading launch data");
    throw new Error("Launch data download failed");
  }

  const launchDocs = response.data.docs;

  for (const launchDoc of launchDocs) {
    const payloads = launchDoc["payloads"];
    const customers = payloads.flatMap((payload) => {
      return payload["customers"];
    });

    const launch = {
      flightNumber: launchDoc["flight_number"],
      mission: launchDoc["name"],
      rocket: launchDoc["rocket"]["name"],
      launchDate: launchDoc["date_local"],
      upcoming: launchDoc["upcoming"],
      success: launchDoc["success"],
      customers: customers,
    };
    // console.log(`${launch.flightNumber} ${launch.mission}`);
    await saveLaunch(launch);
  }
}

async function loadLaunchData() {
  // const firstLaunch = await findLaunch({
  //   flightNumber: 1,
  //   rocket: "Falcon 1",
  //   mission: "FalconSat",
  // });
  // if (firstLaunch) {
  //   console.log("Launch data already loaded!");
  //   return;
  // } else {
  await populateLaunches();
  console.log("Launch data loaded!");
}
// }

async function findLaunch(filter) {
  return await launchesDB.findOne(filter);
}

async function existsLaunchWithId(launchId) {
  // return launches.has(launchId);
  return await findLaunch({ flightNumber: launchId });
}

async function getLatestFlightNumber() {
  const latestLaunch = await launchesDB.findOne().sort("-flightNumber");

  if (!latestLaunch) {
    return DEFAULT_FLIGHT_NUMBER;
  }
  return latestLaunch.flightNumber;
}

async function getAllLaunches(skip, limit) {
  // return Array.from(launches.values());
  return await launchesDB
    .find({}, { _id: 0, __v: 0 })
    .sort({ flightNumber: 1 })
    .skip(skip)
    .limit(limit);
}

// this is an internal function not exposed outside to add launches to the system
async function saveLaunch(launch) {
  await launchesDB.findOneAndUpdate(
    { flightNumber: launch.flightNumber },
    launch,
    {
      upsert: true,
    }
  );
}

async function scheduleNewLaunch(launch) {
  const planet = await planets.findOne({ keplerName: launch.target });

  if (!planet) {
    throw new Error("No matching planet found");
  }
  latestflightNumber = (await getLatestFlightNumber()) + 1; //incrementing the latest flight number by 1

  const newLaunch = Object.assign(launch, {
    success: true,
    upcoming: true,
    customers: ["ztm", "nasa"],
    flightNumber: latestflightNumber,
  });
  await saveLaunch(newLaunch);
}

// function addNewLaunch(launch) {
//   latestflightNumber++;
//   launches.set(
//     latestflightNumber,
//     Object.assign(launch, {
//       success: true,
//       upcoming: true,
//       flightNumber: latestflightNumber,
//       customers: ["ztm", "nasa"],
//     })
//   );
// }

async function abortLaunchById(launchId) {
  const aborted = await launchesDB.updateOne(
    { flightNumber: launchId },
    { upcoming: false, success: false }
  );

  return aborted.modifiedCount === 1;

  // // launches.delete(launchId);
  // const aborted = launches.get(launchId);
  // aborted.upcoming = false;
  // aborted.success = false;
  // return aborted;
}

module.exports = {
  loadLaunchData,
  getAllLaunches,
  scheduleNewLaunch,
  existsLaunchWithId,
  abortLaunchById,
};
