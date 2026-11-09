import * as airQuality from "./airQuality.js";
import * as currentWeather from "./currentWeather.js";
import * as forecast from "./forecast.js";
import * as historicalWeather from "./historicalWeather.js";
import * as searchLocation from "./searchLocation.js";

export { airQuality, currentWeather, forecast, historicalWeather, searchLocation };

/** All tools, in the order they are listed to clients. */
export const ALL_TOOLS = [searchLocation, currentWeather, forecast, airQuality, historicalWeather];
