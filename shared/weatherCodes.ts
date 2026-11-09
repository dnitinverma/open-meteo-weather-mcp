/** WMO weather interpretation codes used by Open-Meteo → condition text + emoji icon. */
export interface WeatherCodeInfo {
  condition: string;
  icon: string;
}

export const WEATHER_CODES: Readonly<Record<number, WeatherCodeInfo>> = {
  0: { condition: "Clear sky", icon: "☀️" },
  1: { condition: "Mainly clear", icon: "🌤️" },
  2: { condition: "Partly cloudy", icon: "⛅" },
  3: { condition: "Overcast", icon: "☁️" },
  45: { condition: "Fog", icon: "🌫️" },
  48: { condition: "Depositing rime fog", icon: "🌫️" },
  51: { condition: "Light drizzle", icon: "🌦️" },
  53: { condition: "Moderate drizzle", icon: "🌦️" },
  55: { condition: "Dense drizzle", icon: "🌧️" },
  56: { condition: "Light freezing drizzle", icon: "🌧️" },
  57: { condition: "Dense freezing drizzle", icon: "🌧️" },
  61: { condition: "Slight rain", icon: "🌦️" },
  63: { condition: "Moderate rain", icon: "🌧️" },
  65: { condition: "Heavy rain", icon: "🌧️" },
  66: { condition: "Light freezing rain", icon: "🌧️" },
  67: { condition: "Heavy freezing rain", icon: "🌧️" },
  71: { condition: "Slight snowfall", icon: "🌨️" },
  73: { condition: "Moderate snowfall", icon: "🌨️" },
  75: { condition: "Heavy snowfall", icon: "❄️" },
  77: { condition: "Snow grains", icon: "🌨️" },
  80: { condition: "Slight rain showers", icon: "🌦️" },
  81: { condition: "Moderate rain showers", icon: "🌧️" },
  82: { condition: "Violent rain showers", icon: "⛈️" },
  85: { condition: "Slight snow showers", icon: "🌨️" },
  86: { condition: "Heavy snow showers", icon: "❄️" },
  95: { condition: "Thunderstorm", icon: "⛈️" },
  96: { condition: "Thunderstorm with slight hail", icon: "⛈️" },
  99: { condition: "Thunderstorm with heavy hail", icon: "⛈️" },
};

const UNKNOWN: WeatherCodeInfo = { condition: "Unknown", icon: "❓" };

export function describeWeatherCode(code: number): WeatherCodeInfo {
  return WEATHER_CODES[code] ?? UNKNOWN;
}
