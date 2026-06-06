// Función para obtener la ubicación del usuario
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition, showError);
    } else {
        showError({ code: 0, message: "Geolocalización no es soportada por este navegador" });
    }
}

// Función para mostrar la posición
function showPosition(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    
    // Actualizar información de ubicación
    document.getElementById('location-name').textContent = "Tu ubicación actual";
    document.getElementById('location-coords').textContent = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
    
    // Obtener datos del clima
    getWeatherData(lat, lon);
}

// Función para manejar errores de geolocalización
function showError(error) {
    const errorMessage = document.getElementById('error-message');
    let message = "";
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = "Permiso denegado. Por favor, permite el acceso a tu ubicación para ver el clima.";
            break;
        case error.POSITION_UNAVAILABLE:
            message = "Información de ubicación no disponible.";
            break;
        case error.TIMEOUT:
            message = "Solicitud de ubicación expirada.";
            break;
        default:
            message = "Error desconocido al obtener la ubicación.";
            break;
    }
    
    errorMessage.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    errorMessage.style.display = "flex";
    
    // Mostrar un clima por defecto
    showDefaultWeather();
}

// Función para obtener datos del clima usando wttr.in
function getWeatherData(lat, lon) {
    const currentWeatherDiv = document.getElementById('current-weather');
    const forecastDiv = document.getElementById('forecast');
    
    // Mostrar indicadores de carga
    currentWeatherDiv.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Cargando datos del clima...</p>
        </div>
    `;
    
    forecastDiv.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Cargando pronóstico...</p>
        </div>
    `;
    
    // URL de wttr.in para obtener datos del clima
    const weatherUrl = `https://wttr.in/${lat},${lon}?format=j1&lang=es`;
    
    fetch(weatherUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al obtener datos del clima');
            }
            return response.json();
        })
        .then(data => {
            // Procesar datos del clima actual
            const current = data.current_condition[0];
            const weatherDesc = current.weatherDesc[0].value;
            const tempC = current.temp_C;
            const feelsLike = current.FeelsLikeC;
            const humidity = current.humidity;
            const windSpeed = current.windspeedKmph;
            const pressure = current.pressure;
            const weatherIcon = getWeatherIcon(current.weatherCode);
            
            // Actualizar clima actual
            currentWeatherDiv.innerHTML = `
                <h2>Clima Actual</h2>
                <div class="weather-main">
                    <div class="weather-icon">
                        <i class="${weatherIcon}"></i>
                    </div>
                    <div class="temperature">${tempC}°C</div>
                </div>
                <p style="font-size: 1.2rem; margin-bottom: 20px; color: #636e72;">${weatherDesc}</p>
                <div class="weather-details">
                    <div class="weather-detail">
                        <i class="fas fa-thermometer-half"></i>
                        <p>Sensación térmica</p>
                        <p>${feelsLike}°C</p>
                    </div>
                    <div class="weather-detail">
                        <i class="fas fa-tint"></i>
                        <p>Humedad</p>
                        <p>${humidity}%</p>
                    </div>
                    <div class="weather-detail">
                        <i class="fas fa-wind"></i>
                        <p>Viento</p>
                        <p>${windSpeed} km/h</p>
                    </div>
                    <div class="weather-detail">
                        <i class="fas fa-compress-arrows-alt"></i>
                        <p>Presión</p>
                        <p>${pressure} hPa</p>
                    </div>
                </div>
            `;
            
            // Procesar pronóstico extendido
            const forecast = data.weather;
            let forecastHTML = '';
            
            // Limitar a 5 días de pronóstico
            for (let i = 0; i < Math.min(5, forecast.length); i++) {
                const day = forecast[i];
                const date = new Date(day.date);
                const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
                const maxTemp = day.maxtempC;
                const minTemp = day.mintempC;
                const avgTemp = Math.round((maxTemp + minTemp) / 2);
                const weatherCode = day.hourly[0].weatherCode;
                const weatherIcon = getWeatherIcon(weatherCode);
                
                forecastHTML += `
                    <div class="forecast-day">
                        <p>${dayName}</p>
                        <div class="forecast-icon">
                            <i class="${weatherIcon}"></i>
                        </div>
                        <div class="forecast-temp">${avgTemp}°C</div>
                        <div class="forecast-desc">${day.hourly[0].weatherDesc[0].value}</div>
                    </div>
                `;
            }
            
            forecastDiv.innerHTML = forecastHTML;
        })
        .catch(error => {
            console.error('Error:', error);
            const errorMessage = document.getElementById('error-message');
            errorMessage.innerHTML = `<i class="fas fa-exclamation-circle"></i> Error al cargar los datos del clima. Por favor, intenta de nuevo más tarde.`;
            errorMessage.style.display = "flex";
            showDefaultWeather();
        });
}

// Función para mostrar clima por defecto
function showDefaultWeather() {
    const currentWeatherDiv = document.getElementById('current-weather');
    const forecastDiv = document.getElementById('forecast');
    
    currentWeatherDiv.innerHTML = `
        <h2>Clima Actual</h2>
        <div class="weather-main">
            <div class="weather-icon">
                <i class="fas fa-cloud-sun"></i>
            </div>
            <div class="temperature">--°C</div>
        </div>
        <p style="font-size: 1.2rem; margin-bottom: 20px; color: #636e72;">No disponible</p>
        <div class="weather-details">
            <div class="weather-detail">
                <i class="fas fa-thermometer-half"></i>
                <p>Sensación térmica</p>
                <p>--°C</p>
            </div>
            <div class="weather-detail">
                <i class="fas fa-tint"></i>
                <p>Humedad</p>
                <p>--%</p>
            </div>
            <div class="weather-detail">
                <i class="fas fa-wind"></i>
                <p>Viento</p>
                <p>-- km/h</p>
            </div>
            <div class="weather-detail">
                <i class="fas fa-compress-arrows-alt"></i>
                <p>Presión</p>
                <p>-- hPa</p>
            </div>
        </div>
    `;
    
    forecastDiv.innerHTML = `
        <div class="forecast-day">
            <p>Pronóstico no disponible</p>
            <div class="forecast-icon">
                <i class="fas fa-cloud"></i>
            </div>
            <div class="forecast-temp">--°C</div>
            <div class="forecast-desc">Permite el acceso a tu ubicación</div>
        </div>
    `;
}

// Función para obtener el icono del clima según el código
function getWeatherIcon(weatherCode) {
    // Códigos basados en wttr.in
    if (weatherCode >= 113 && weatherCode <= 116) return 'fas fa-sun'; // Despejado
    if (weatherCode >= 116 && weatherCode <= 119) return 'fas fa-cloud-sun'; // Parcialmente nublado
    if (weatherCode >= 119 && weatherCode <= 124) return 'fas fa-cloud'; // Nublado
    if (weatherCode >= 143 && weatherCode <= 179) return 'fas fa-smog'; // Niebla
    if (weatherCode >= 223 && weatherCode <= 229) return 'fas fa-cloud-showers-heavy'; // Lluvia fuerte
    if (weatherCode >= 230 && weatherCode <= 232) return 'fas fa-cloud-rain'; // Lluvia
    if (weatherCode >= 299 && weatherCode <= 302) return 'fas fa-cloud-showers-heavy'; // Tormenta
    if (weatherCode >= 305 && weatherCode <= 312) return 'fas fa-cloud-rain'; // Lluvia ligera
    if (weatherCode >= 314 && weatherCode <= 321) return 'fas fa-cloud-showers-heavy'; // Lluvia moderada
    if (weatherCode >= 500 && weatherCode <= 531) return 'fas fa-cloud-showers-heavy'; // Lluvia intensa
    if (weatherCode >= 600 && weatherCode <= 602) return 'fas fa-snowflake'; // Nieve ligera
    if (weatherCode >= 602 && weatherCode <= 622) return 'fas fa-snowflake'; // Nieve
    if (weatherCode >= 621 && weatherCode <= 622) return 'fas fa-snowflake'; // Nieve fuerte
    if (weatherCode >= 700 && weatherCode <= 716) return 'fas fa-smog'; // Niebla
    if (weatherCode >= 721 && weatherCode <= 731) return 'fas fa-smog'; // Niebla
    if (weatherCode >= 741 && weatherCode <= 761) return 'fas fa-smog'; // Niebla
    if (weatherCode >= 771 && weatherCode <= 781) return 'fas fa-wind'; // Viento fuerte
    if (weatherCode === 800) return 'fas fa-sun'; // Despejado
    if (weatherCode === 801) return 'fas fa-cloud-sun'; // Parcialmente nublado
    if (weatherCode === 802) return 'fas fa-cloud'; // Nublado
    if (weatherCode === 803) return 'fas fa-cloud'; // Nublado
    if (weatherCode === 804) return 'fas fa-cloud'; // Nublado
    return 'fas fa-cloud'; // Por defecto
}

// Evento para el botón de actualización
document.getElementById('refresh-btn').addEventListener('click', function() {
    getLocation();
});

// Cargar la aplicación
window.addEventListener('load', getLocation);