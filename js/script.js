document.addEventListener('DOMContentLoaded', function() {
    let map;
    let earthquakes = [];

    function initMap() {
        map = L.map('map').setView([0, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
    }

    async function fetchEarthquakes() {
        const response = await fetch('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2024-06-02&endtime=2024-07-02&minmagnitude=4');
        const data = await response.json();
        return data.features;
    }

    function updateUI(quakes) {
        try {
            earthquakes = quakes;
            updateQuakeList();
            updateMap();
            updateCharts();
            document.getElementById('update-time').textContent = new Date().toLocaleString();
        } catch (error) {
            console.error('Error updating UI:', error);
        }
    }
    

    function updateQuakeList() {
        const quakeList = document.getElementById('quake-list');
        quakeList.innerHTML = '';
        
        earthquakes.forEach((quake, index) => {
            const magnitude = quake.properties.mag;
            const location = quake.properties.place;
            const time = new Date(quake.properties.time).toLocaleString();
            
            const quakeItem = document.createElement('a');
            quakeItem.href = '#';
            quakeItem.classList.add('list-group-item', 'list-group-item-action', `magnitude-${Math.floor(magnitude)}`);
            quakeItem.innerHTML = `
                <strong>M${magnitude.toFixed(1)}</strong> - ${location}<br>
                ${time}
            `;
            quakeItem.addEventListener('click', (e) => {
                e.preventDefault();
                zoomToQuake(quake);
            });
            quakeList.appendChild(quakeItem);
        });
    }

    function updateMap() {
        map.eachLayer((layer) => {
            if (layer instanceof L.CircleMarker) {
                map.removeLayer(layer);
            }
        });

        earthquakes.forEach(quake => {
            const [lon, lat] = quake.geometry.coordinates;
            const magnitude = quake.properties.mag;
            const radius = Math.pow(2, magnitude) * 1000;

            const circle = L.circle([lat, lon], {
                color: getColor(magnitude),
                fillColor: getColor(magnitude),
                fillOpacity: 0.5,
                radius: radius
            }).addTo(map);

            circle.bindPopup(createPopupContent(quake));
        });
    }

    function getColor(magnitude) {
        if (magnitude <= 3) return '#4caf50';
        if (magnitude <= 5) return '#ffc107';
        if (magnitude <= 7) return '#ff5722';
        return '#b71c1c';
    }

    function createPopupContent(quake) {
        const magnitude = quake.properties.mag;
        const location = quake.properties.place;
        const time = new Date(quake.properties.time).toLocaleString();
        const depth = quake.geometry.coordinates[2];

        return `
            <h5>M${magnitude.toFixed(1)} Earthquake</h5>
            <p>${location}</p>
            <p>Time: ${time}</p>
            <p>Depth: ${depth.toFixed(2)} km</p>
            <canvas id="quake-comparison-chart" width="200" height="100"></canvas>
        `;
    }

    function zoomToQuake(quake) {
        const [lon, lat] = quake.geometry.coordinates;
        map.setView([lat, lon], 6);
        const popup = L.popup()
            .setLatLng([lat, lon])
            .setContent(createPopupContent(quake))
            .openOn(map);

        // Create comparison chart after popup is opened
        setTimeout(() => {
            createComparisonChart(quake);
        }, 100);
    }

    function createComparisonChart(quake) {
        const ctx = document.getElementById('quake-comparison-chart').getContext('2d');
        const magnitudes = earthquakes.map(q => q.properties.mag);
        const maxMagnitude = Math.max(...magnitudes);
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['This Quake', 'Max Recorded'],
                datasets: [{
                    label: 'Magnitude',
                    data: [quake.properties.mag, maxMagnitude],
                    backgroundColor: [getColor(quake.properties.mag), getColor(maxMagnitude)]
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        max: Math.ceil(maxMagnitude)
                    }
                }
            }
        });
    }

    function updateCharts() {
        try {
            updateMagnitudeChart();
            updateHourlyChart();
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }

    let magnitudeChart = null;
    let hourlyChart = null;

    function updateMagnitudeChart() {
        const magnitudeCounts = earthquakes.reduce((acc, quake) => {
            const mag = Math.floor(quake.properties.mag);
            acc[mag] = (acc[mag] || 0) + 1;
            return acc;
        }, {});
    
        const ctx = document.getElementById('magnitude-chart').getContext('2d');
        
        if (magnitudeChart) {
            magnitudeChart.destroy();
        }
    
        magnitudeChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(magnitudeCounts),
                datasets: [{
                    data: Object.values(magnitudeCounts),
                    backgroundColor: Object.keys(magnitudeCounts).map(mag => getColor(parseInt(mag)))
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                title: {
                    display: true,
                    text: 'Earthquakes by Magnitude'
                }
            }
        });
    }

    function updateHourlyChart() {
        const now = new Date();
        const hourlyData = Array(24).fill(0);
    
        earthquakes.forEach(quake => {
            const quakeTime = new Date(quake.properties.time);
            const hoursDiff = Math.floor((now - quakeTime) / (1000 * 60 * 60));
            if (hoursDiff < 24) {
                hourlyData[23 - hoursDiff]++;
            }
        });
    
        const ctx = document.getElementById('hourly-chart').getContext('2d');
        
        if (hourlyChart) {
            hourlyChart.destroy();
        }
    
        hourlyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${23-i}h ago`),
                datasets: [{
                    label: 'Earthquakes',
                    data: hourlyData,
                    borderColor: '#ffc107',
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                title: {
                    display: true,
                    text: 'Earthquakes in the Last 24 Hours'
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function sortEarthquakes(method) {
        switch(method) {
            case 'recent':
                earthquakes.sort((a, b) => b.properties.time - a.properties.time);
                break;
            case 'magnitude':
                earthquakes.sort((a, b) => b.properties.mag - a.properties.mag);
                break;
            case 'continent':
                earthquakes.sort((a, b) => {
                    const placeA = a.properties.place || '';
                    const placeB = b.properties.place || '';
                    return placeA.localeCompare(placeB);
                });
                break;
        }
        updateUI(earthquakes);
    }

    document.getElementById('sort-recent').addEventListener('click', () => sortEarthquakes('recent'));
    document.getElementById('sort-magnitude').addEventListener('click', () => sortEarthquakes('magnitude'));
    document.getElementById('sort-continent').addEventListener('click', () => sortEarthquakes('continent'));

    async function init() {
        initMap();
        const quakes = await fetchEarthquakes();
        updateUI(quakes);
        setInterval(async () => {
            const updatedQuakes = await fetchEarthquakes();
            updateUI(updatedQuakes);
        }, 300000); // Update every 5 minutes
    }

    init();
});