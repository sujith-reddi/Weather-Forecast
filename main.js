const API_KEY = "9cdfd46a548a948d98d750db61ab4f57";
const DAYS_OF_THE_WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
let selectedCityText, selectedCity;

const changeTime = (unix_time, time_zone) => new Date(`${unix_time}`*1000).toLocaleString('en-US', { timeZone: `${time_zone}`}).slice(11,15);

const formatTemperature = (temp) => `${temp?.toFixed(0)}°`; // ? - optional chaining

const createIconUrl = (icon) => `http://openweathermap.org/img/wn/${icon}@2x.png`;

const formatTime = (time_txt) => new Date(time_txt * 1000).toString().slice(16,21);

const getCitiesUsingGeolocation = async (searchText) => {
    const response = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${searchText}&appid=${API_KEY}`);
    return response.json();
}

const getCurrentWeatherData = async({lat, lon, name: city}) => {
    const url = lat && lon ? `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&APPID=${API_KEY}&units=metric` : `https://api.openweathermap.org/data/2.5/weather?q=${city}&APPID=${API_KEY}&units=metric`;
    const response = await fetch(url);
    return response.json();
};

const getLocationDetails = async({lat, lon}) => {
    const locationDetails = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&format=json&apiKey=cc2b53353aaf4d5c8f660e90e0036332`);
    const data = await locationDetails.json();
    return data;
}

const getHourlyForecast = async({name: city}) => {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&APPID=${API_KEY}&units=metric`);
    const data = await response.json();
    return data.list.map(forecast => {
        const {main: {temp, temp_max, temp_min}, dt, dt_txt, weather: [{description, icon}]} = forecast;
        return {temp, temp_max, temp_min, dt, dt_txt, description, icon};
    });
};

const loadCurrentForecast = (data, {main:{temp, temp_max, temp_min, pressure}, sys:{sunrise, sunset}, weather:[{description}], visibility, wind:{speed}}) => {
    const currentForecastLocation = document.querySelector("#current-forecast-location");
    currentForecastLocation.innerHTML = `<h1 class="place-time">${data.results[0].city}, ${data.results[0].state}, ${data.results[0].country}  As of ${new Date().toLocaleString('en-US', `{timeZone: ${data.results[0].timezone.name},}`).slice(11, 15)} ${data.results[0].timezone.abbreviation_STD} </h1>`;

    const currentForecastElement = document.querySelector("#current-forecast");
    currentForecastElement.querySelector(".temp").textContent = formatTemperature(temp);
    currentForecastElement.querySelector(".description").textContent = description;
    currentForecastElement.querySelector(".sunrise").textContent = changeTime(sunrise, data.results[0].timezone.abbreviation_STD);
    currentForecastElement.querySelector(".sunset").textContent = changeTime(sunset, data.results[0].timezone.abbreviation_STD);
    currentForecastElement.querySelector(".min-max-temp").textContent = `${temp_max?.toFixed(1)}°/${temp_min?.toFixed(1)}°`;
    currentForecastElement.querySelector(".wind").textContent = `${Math.round(speed)} km/h`;
    currentForecastElement.querySelector(".pressure").textContent = `${pressure} mb`;
    currentForecastElement.querySelector(".visibility").textContent = visibility;
    
};

const loadHourlyForecast = ({main: {temp: tempNow}, weather: [{icon: iconNow}]}, hourlyForecast) => {
    const timeFormatter = Intl.DateTimeFormat("en",{hour12: true, hour:"numeric"});
    let dataFor12Hours = hourlyForecast.slice(2, 14);
    const hourlyContainer = document.querySelector(".hourly-container");
    let innerHTMLString = `<article>
                <h3 class="time">Now</h3>
                <img class="icon" src="${createIconUrl(iconNow)}" alt="">
                <p class="hourly-temp">${formatTemperature(tempNow)}</p>
            </article>`;
    for(let {temp, icon, dt_txt} of dataFor12Hours) {
        innerHTMLString += `<article>
                <h3 class="time">${timeFormatter.format(new Date(dt_txt))}</h3>
                <img class="icon" src="${createIconUrl(icon)}" alt="">
                <p class="hourly-temp">${formatTemperature(temp)}</p>
            </article>`;
    }
    hourlyContainer.innerHTML = innerHTMLString;
};

const calculateDayWiseForecast = (hourlyForecast) => {
    let dayWiseForecast = new Map();
    for (let forecast of hourlyForecast) {
        const [date] = forecast.dt_txt.split(" ");
        const dayOfTheWeek = DAYS_OF_THE_WEEK[new Date(date).getDay()];
        if (dayWiseForecast.has(dayOfTheWeek)) {
            let forecastForTheDay = dayWiseForecast.get(dayOfTheWeek);
            forecastForTheDay.push(forecast);
            dayWiseForecast.set(dayOfTheWeek, forecastForTheDay);
        } else {
            dayWiseForecast.set(dayOfTheWeek, [forecast]);
        }
    }
    for (let [key, value] of dayWiseForecast) {
        let temp_min = Math.min(...Array.from(value, val => val.temp_min));
        let temp_max = Math.max(...Array.from(value, val => val.temp_max));
        dayWiseForecast.set(key, {temp_min, temp_max, icon: value.find(v => v.icon).icon});
    }
    return dayWiseForecast;
}

const loadFiveDayForecast = (hourlyForecast) => {
    const dayWiseForecast = calculateDayWiseForecast(hourlyForecast);
    const container = document.querySelector(".five-day-forecast-container");
    let dayWiseInfo = "";
    Array.from(dayWiseForecast).map(([day, {temp_max, temp_min, icon}], index) => {
        if (index < 5) {
            dayWiseInfo += `
                <article class="day-wise-forecast">
                    <h3 class="day">${index === 0 ? "today" : day}</h3>
                    <img class="icon" src="${createIconUrl(icon)}" alt="icon for forecast" />
                    <p class="min-temp" title="Minimum temperature">${formatTemperature(temp_min)}</p>
                    <p class="max-temp" title="Maximum temperature">${formatTemperature(temp_max)}</p>
                </article>`;
        }
    });
    container.innerHTML = dayWiseInfo;
}

const loadFeelsLike = ({main: { feels_like }}) => {
    let container = document.querySelector("#feels-like");
    container.querySelector(".feels-like-temp").textContent = formatTemperature(feels_like);
}

const loadHumidity = ({ main: {humidity}}) => {
    let container = document.querySelector("#humidity");
    container.querySelector(".humidity-value").textContent = `${humidity}%`;
}

const loadForecastGeoLocation = () => {
    navigator.geolocation.getCurrentPosition(({coords}) => {
        const {latitude: lat, longitude: lon} = coords;
        selectedCity = {lat, lon};
        loadData();
    }, error => console.log(error))
}

const loadData = async () => {
    const currentWeather = await getCurrentWeatherData(selectedCity);
    const displayLocation = await getLocationDetails(selectedCity);
    loadCurrentForecast(displayLocation, currentWeather);
    const hourlyForecast = await getHourlyForecast(currentWeather);
    loadHourlyForecast(currentWeather, hourlyForecast);
    loadFiveDayForecast(hourlyForecast);
    loadFeelsLike(currentWeather);
    loadHumidity(currentWeather);
}

function debounce(func) {
    let timer;
    return (...args) => {
        clearTimeout(timer); // clear existing timer
        // create a new time till the user is typing
        timer = setTimeout(() => {
            func.apply(this, args)
        }, 500);
    }
}

const onSearchChange = async (event) => {
    let {value} = event.target;
    if (!value) {
        selectedCity = null;
        selectedCityText = "";
    }
    if (value && selectedCityText !== value) {
        const listOfCities = await getCitiesUsingGeolocation(value);
        let options = "";
        for (let {lat, lon, name, state, country} of listOfCities) {
            options += `<option data-city-details='${JSON.stringify({lat, lon, name})}' value="${name}, ${state}, ${country}"></option>`
        }
        document.querySelector("#cities").innerHTML = options;
    }
}

const handleCitySelection = (event) => {
    selectedCityText = event.target.value;
    let options = document.querySelectorAll("#cities > option");
    if (options?.length) {
        let selectedOption = Array.from(options).find(opt => opt.value === selectedCityText);
        selectedCity = JSON.parse(selectedOption.getAttribute("data-city-details"));
        loadData();
    }
}

const debounceSearch = debounce((event) => onSearchChange(event))

document.addEventListener("DOMContentLoaded", async() => {
    loadForecastGeoLocation();
    const searchInput = document.querySelector("#search");
    searchInput.addEventListener("input", debounceSearch);
    searchInput.addEventListener("change", handleCitySelection);
});
