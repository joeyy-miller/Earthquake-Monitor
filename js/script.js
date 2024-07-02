document.addEventListener('DOMContentLoaded', function() {
    let map;
    let earthquakes = [];

    function initMap() {
        // Start with a more zoomed-in view
        map = L.map('map', {
            center: [20, 0],  // Centering around 20° latitude, 0° longitude
            zoom: 3,          // Increased zoom level
            minZoom: 3,       // Set minimum zoom to prevent zooming out too far
            worldCopyJump: true  // Allows the map to wrap around the antimeridian
        });
    
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
    
        // Trigger a resize event after map initialization
        setTimeout(() => {
            map.invalidateSize();
        }, 0);
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

    const sortButtons = document.querySelectorAll('.sort-btn');
        
    function handleSortClick(event) {
        // Remove 'active-sort' class from all buttons
        sortButtons.forEach(button => button.classList.remove('active-sort'));
        
        // Add 'active-sort' class to the clicked button
        event.target.classList.add('active-sort');
        
        // Call the sortEarthquakes function with the appropriate method
        const sortMethod = event.target.id.split('-')[1]; // Extracts 'recent', 'magnitude', or 'continent'
        sortEarthquakes(sortMethod);
    }
    
    // Add click event listener to each sort button
    sortButtons.forEach(button => {
        button.addEventListener('click', handleSortClick);
    });
    

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
            
            // New scaling function
            const baseRadius = calculateRadius(magnitude);
    
            // Create concentric rings
            const rings = [1, 0.75, 0.5, 0.25]; // Percentage of the base radius
            rings.forEach((ringPercentage, index) => {
                const radius = baseRadius * ringPercentage;
                const circle = L.circle([lat, lon], {
                    color: getColor(magnitude, index),
                    fillColor: getColor(magnitude, index),
                    fillOpacity: 0.2 + (index * 0.2), // Inner rings are more opaque
                    weight: 1,
                    radius: radius
                }).addTo(map);
    
                // Only add popup to the innermost ring
                if (index > 0) {
                    circle.bindPopup(createPopupContent(quake));
                }
            });
        });
    }

    function calculateRadius(magnitude) {
        // More dramatic scaling function
        if (magnitude < 3) {
            return Math.pow(2, magnitude) * 100; // Smaller for low magnitudes
        } else if (magnitude < 5) {
            return Math.pow(2, magnitude) * 1000;
        } else if (magnitude < 7) {
            return Math.pow(2.5, magnitude) * 1000;
        } else {
            return Math.pow(2.5, magnitude) * 2000; // Much larger for high magnitudes
        }
    }
    
    function getColor(magnitude, ringIndex) {
        const baseColor = magnitude <= 3 ? '#4caf50' :
                          magnitude <= 5 ? '#ffc107' :
                          magnitude <= 7 ? '#ff5722' : '#b71c1c';
        
        const alternateColor = magnitude <= 3 ? '#45a049' :
                               magnitude <= 5 ? '#e6ac00' :
                               magnitude <= 7 ? '#e64a19' : '#9e1818';
        
        return ringIndex % 2 === 0 ? baseColor : alternateColor;
    }

    function createPopupContent(quake) {
        const magnitude = quake.properties.mag;
        const location = quake.properties.place;
        const time = new Date(quake.properties.time).toLocaleString();
        const depth = quake.geometry.coordinates[2];
        const chartId = `quake-chart-${quake.id}`;
    
        return `
            <h5>M${magnitude.toFixed(1)} Earthquake</h5>
            <p><strong>Location:</strong> ${location}</p>
            <p><strong>Time:</strong> ${time}</p>
            <p><strong>Depth:</strong> ${depth.toFixed(2)} km</p>
            <canvas id="${chartId}" width="200" height="100"></canvas>
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
        const chartId = `quake-chart-${quake.id}`;
        const ctx = document.getElementById(chartId).getContext('2d');
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
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Magnitude Comparison',
                        color: '#ffffff'
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#ffffff'
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#ffffff'
                        }
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
    
        const labels = Object.keys(magnitudeCounts).sort((a, b) => Number(a) - Number(b));
        const data = labels.map(label => magnitudeCounts[label]);
    
        magnitudeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Number of Earthquakes',
                    data: data,
                    backgroundColor: labels.map(mag => getColor(Number(mag))),
                    borderColor: labels.map(mag => getColor(Number(mag))),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Earthquakes by Magnitude',
                        color: '#ffffff'
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#ffffff'
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#ffffff'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Magnitude ${context.label}: ${context.raw} earthquakes`;
                        }
                    }
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
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: false
                        }
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
    
    // Optionally, set the 'Most Recent' button as active by default
    document.getElementById('sort-recent').classList.add('active-sort');

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