// Timeline Events App JavaScript

// Global variables
let svg, g, zoom;
let canvasWidth = 1600;
let canvasHeight = 800;
let currentZoom = 1;
let transform = d3.zoomIdentity;

// Data structures
let timelines = [];
let events = [];
let eventIdCounter = 0;

// Color palette for timelines
const colors = [
    '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
];

// Initialize the application
function init() {
    createInitialData();
    renderChart();
    updateZoomInfo();
}

// Create initial sample data with 50-200 events per timeline
function createInitialData() {
    // Create 5 timelines
    for (let i = 0; i < 5; i++) {
        timelines.push({
            id: i,
            name: `Линия ${i + 1}`,
            y: 120 + i * 140,
            color: colors[i]
        });
    }

    const now = new Date();
    const timeRange = 86400000 * 60; // 60 days range

    // Create 50-200 events per timeline
    timelines.forEach(timeline => {
        const eventCount = Math.floor(Math.random() * 150) + 50; // 50 to 200 events
        
        for (let i = 0; i < eventCount; i++) {
            const timeOffset = Math.random() * timeRange;
            const eventTime = new Date(now.getTime() - timeOffset);
            
            const event = {
                id: eventIdCounter++,
                timelineId: timeline.id,
                parentId: null,
                time: eventTime,
                title: `Событие ${eventIdCounter}`,
                description: `Описание события ${eventIdCounter}. Это пример подробного описания.`,
                data: {
                    type: ['Тип A', 'Тип B', 'Тип C', 'Тип D'][Math.floor(Math.random() * 4)],
                    priority: ['Низкий', 'Средний', 'Высокий', 'Критический'][Math.floor(Math.random() * 4)],
                    status: ['Активно', 'Завершено', 'В ожидании', 'Отменено'][Math.floor(Math.random() * 4)],
                    value: Math.floor(Math.random() * 1000),
                    category: `Категория ${Math.floor(Math.random() * 5) + 1}`
                }
            };
            events.push(event);
        }
    });

    // Create hierarchical event trees (events attached to other events)
    // Each timeline will have several event trees
    timelines.forEach(timeline => {
        const timelineEvents = events.filter(e => e.timelineId === timeline.id && !e.parentId);
        const treeCount = Math.floor(Math.random() * 5) + 3; // 3-8 trees per timeline
        
        for (let t = 0; t < treeCount; t++) {
            // Pick a random root event
            if (timelineEvents.length > 0) {
                const rootIndex = Math.floor(Math.random() * timelineEvents.length);
                const rootEvent = timelineEvents[rootIndex];
                
                // Create 2-6 child events
                const childCount = Math.floor(Math.random() * 5) + 2;
                let parentEvent = rootEvent;
                
                for (let c = 0; c < childCount; c++) {
                    const childTime = new Date(parentEvent.time.getTime() + (Math.random() * 86400000 * 3)); // Within 3 days
                    const childEvent = {
                        id: eventIdCounter++,
                        timelineId: parentEvent.timelineId,
                        parentId: parentEvent.id,
                        time: childTime,
                        title: `Подсобытие ${eventIdCounter}`,
                        description: `Это подсобытие привязано к "${parentEvent.title}"`,
                        data: {
                            type: 'Подсобытие',
                            priority: ['Низкий', 'Средний', 'Высокий'][Math.floor(Math.random() * 3)],
                            status: 'Активно',
                            value: Math.floor(Math.random() * 500),
                            parentTitle: parentEvent.title,
                            level: c + 1
                        }
                    };
                    events.push(childEvent);
                    
                    // 50% chance to continue the chain
                    if (Math.random() < 0.5) {
                        parentEvent = childEvent;
                    }
                }
            }
        }
    });
}

// Render the chart
function renderChart() {
    // Clear existing SVG
    d3.select('#chart').html('');
    
    // Create SVG
    svg = d3.select('#chart')
        .attr('width', canvasWidth)
        .attr('height', canvasHeight)
        .attr('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);

    // Create group for zooming
    g = svg.append('g');

    // Setup zoom behavior
    zoom = d3.zoom()
        .scaleExtent([0.1, 5])
        .on('zoom', handleZoom);

    svg.call(zoom);

    // Draw everything
    drawTimelines();
    drawEvents();
    drawConnections();
    drawTimeLabels();
}

// Draw timeline lines with time labels on each line
function drawTimelines() {
    timelines.forEach(timeline => {
        // Count events for this timeline (only root events, not children)
        const eventCount = events.filter(e => e.timelineId === timeline.id && !e.parentId).length;
        
        // Draw timeline
        g.append('path')
            .attr('class', 'timeline-line')
            .attr('d', `M 50 ${timeline.y} L ${canvasWidth - 50} ${timeline.y}`)
            .attr('stroke', timeline.color)
            .attr('stroke-width', 3);

        // Add line label with event counter
        g.append('text')
            .attr('class', 'line-label')
            .attr('x', 60)
            .attr('y', timeline.y - 10)
            .text(`${timeline.name} (${eventCount})`);
    });
}

// Draw events with clustering
function drawEvents() {
    const clusterThreshold = 30 / currentZoom; // Pixels threshold for clustering
    
    // Group events by timeline and proximity
    const clusters = {};
    
    timelines.forEach(timeline => {
        const timelineEvents = events.filter(e => e.timelineId === timeline.id && !e.parentId);
        const sortedEvents = timelineEvents.sort((a, b) => a.time - b.time);
        
        clusters[timeline.id] = [];
        let currentCluster = [];
        
        sortedEvents.forEach((event, index) => {
            if (currentCluster.length === 0) {
                currentCluster.push(event);
            } else {
                const lastEvent = currentCluster[currentCluster.length - 1];
                const xLast = getTimePosition(lastEvent.time);
                const xCurrent = getTimePosition(event.time);
                
                if (xCurrent - xLast < clusterThreshold) {
                    currentCluster.push(event);
                } else {
                    clusters[timeline.id].push(currentCluster);
                    currentCluster = [event];
                }
            }
            
            if (index === sortedEvents.length - 1) {
                clusters[timeline.id].push(currentCluster);
            }
        });
    });

    // Draw clusters or individual events
    Object.keys(clusters).forEach(timelineId => {
        const timeline = timelines.find(t => t.id == timelineId);
        
        clusters[timelineId].forEach(cluster => {
            const x = getTimePosition(cluster[0].time);
            const y = timeline.y;
            
            if (cluster.length === 1) {
                // Single event
                g.append('circle')
                    .attr('class', 'event-point')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', 8)
                    .attr('fill', '#2ecc71')
                    .attr('stroke', '#27ae60')
                    .attr('stroke-width', 2)
                    .on('click', () => showEventDetails(cluster[0]));
            } else {
                // Cluster
                g.append('circle')
                    .attr('class', 'cluster-circle')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', 15)
                    .attr('fill', '#e74c3c');
                
                g.append('text')
                    .attr('class', 'event-cluster')
                    .attr('x', x)
                    .attr('y', y + 5)
                    .attr('text-anchor', 'middle')
                    .attr('fill', 'white')
                    .attr('font-size', '10px')
                    .text(cluster.length);
                
                // Make cluster clickable to show all events
                g.append('circle')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', 15)
                    .attr('fill', 'transparent')
                    .attr('cursor', 'pointer')
                    .on('click', () => showClusterDetails(cluster));
            }
        });
    });
}

// Draw connections between parent and child events
function drawConnections() {
    const childEvents = events.filter(e => e.parentId !== null);
    
    childEvents.forEach(child => {
        const parent = events.find(e => e.id === child.parentId);
        if (parent) {
            const parentX = getTimePosition(parent.time);
            const parentY = timelines.find(t => t.id === parent.timelineId).y;
            const childX = getTimePosition(child.time);
            const childY = parentY + 30; // Child events appear below the line
            
            // Draw vertical line from event to timeline (strictly vertical)
            g.append('line')
                .attr('class', 'connection-line-vertical')
                .attr('x1', childX)
                .attr('y1', parentY)
                .attr('x2', childX)
                .attr('y2', childY);
            
            // Draw connection line between parent and child (any direction)
            g.append('line')
                .attr('class', 'connection-line')
                .attr('x1', parentX)
                .attr('y1', parentY)
                .attr('x2', childX)
                .attr('y2', childY);
            
            // Draw child event
            g.append('circle')
                .attr('class', 'event-point')
                .attr('cx', childX)
                .attr('cy', childY)
                .attr('r', 6)
                .attr('fill', '#f39c12')
                .attr('stroke', '#e67e22')
                .attr('stroke-width', 2)
                .on('click', () => showEventDetails(child));
        }
    });
}

// Draw time labels on each timeline line
function drawTimeLabels() {
    const now = new Date();
    const timeRange = 86400000 * 60; // 60 days
    
    timelines.forEach(timeline => {
        // Draw labels every 5 days on each timeline
        for (let i = 0; i <= 12; i++) {
            const time = new Date(now.getTime() - (timeRange / 12) * i);
            const x = getTimePosition(time);
            
            // Time label on the timeline
            g.append('text')
                .attr('class', 'time-label-on-line')
                .attr('x', x)
                .attr('y', timeline.y - 15)
                .attr('text-anchor', 'middle')
                .text(formatDateFull(time));
            
            // Small tick mark on the timeline
            g.append('line')
                .attr('class', 'time-tick')
                .attr('x1', x)
                .attr('y1', timeline.y - 5)
                .attr('x2', x)
                .attr('y2', timeline.y + 5)
                .attr('stroke', timeline.color)
                .attr('stroke-width', 2);
        }
    });
}

// Get X position for a given time
function getTimePosition(time) {
    const now = new Date();
    const timeRange = 86400000 * 60; // 60 days
    const msDiff = now.getTime() - time.getTime();
    const ratio = msDiff / timeRange;
    return 50 + ratio * (canvasWidth - 100);
}

// Format date for display (DD.MM.YYYY)
function formatDateFull(date) {
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Format date for display (short)
function formatDate(date) {
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
}

// Handle zoom
function handleZoom(event) {
    transform = event.transform;
    g.attr('transform', transform);
    currentZoom = transform.k;
    updateZoomInfo();
    
    // Redraw everything with updated clustering and time labels
    g.selectAll('.event-point, .cluster-circle, .event-cluster, .time-label-on-line, .time-tick, .connection-line, .connection-line-vertical').remove();
    drawEvents();
    drawConnections();
    drawTimeLabels();
}

// Reset zoom
function resetZoom() {
    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity
    );
}

// Update canvas size
function updateCanvasSize() {
    const newWidth = parseInt(document.getElementById('canvasWidth').value);
    const newHeight = parseInt(document.getElementById('canvasHeight').value);
    
    if (newWidth >= 600 && newWidth <= 3000 && newHeight >= 400 && newHeight <= 2000) {
        canvasWidth = newWidth;
        canvasHeight = newHeight;
        
        // Update timeline Y positions
        timelines.forEach((timeline, index) => {
            timeline.y = 100 + index * (canvasHeight / timelines.length);
        });
        
        renderChart();
    } else {
        alert('Размеры должны быть в пределах: ширина 600-3000, высота 400-2000');
    }
}

// Add new timeline
function addNewLine() {
    const newId = timelines.length;
    timelines.push({
        id: newId,
        name: `Линия ${newId + 1}`,
        y: 120 + newId * 140,
        color: colors[newId % colors.length]
    });
    
    // Adjust canvas height if needed
    if (timelines.length * 140 > canvasHeight - 100) {
        canvasHeight = timelines.length * 140 + 100;
        document.getElementById('canvasHeight').value = canvasHeight;
    }
    
    renderChart();
}

// Add random event
function addRandomEvent() {
    if (timelines.length === 0) return;
    
    const now = new Date();
    const timeOffset = Math.random() * 86400000 * 60; // 60 days
    const eventTime = new Date(now.getTime() - timeOffset);
    const timelineId = Math.floor(Math.random() * timelines.length);
    
    // 30% chance to attach to existing event
    let parentId = null;
    if (Math.random() < 0.3 && events.length > 0) {
        const randomParent = events[Math.floor(Math.random() * events.length)];
        parentId = randomParent.id;
    }
    
    events.push({
        id: eventIdCounter++,
        timelineId: timelineId,
        parentId: parentId,
        time: eventTime,
        title: `Новое событие ${eventIdCounter}`,
        description: `Событие создано ${new Date().toLocaleString('ru-RU')}`,
        data: {
            type: ['Тип A', 'Тип B', 'Тип C', 'Тип D'][Math.floor(Math.random() * 4)],
            priority: ['Низкий', 'Средний', 'Высокий', 'Критический'][Math.floor(Math.random() * 4)],
            status: 'Активно',
            value: Math.floor(Math.random() * 1000),
            category: `Категория ${Math.floor(Math.random() * 5) + 1}`
        }
    });
    
    renderChart();
}

// Add event tree (hierarchical events)
function addEventTree() {
    if (timelines.length === 0) return;
    
    const now = new Date();
    const timelineId = Math.floor(Math.random() * timelines.length);
    const timeline = timelines[timelineId];
    
    // Create root event
    const timeOffset = Math.random() * 86400000 * 60;
    const rootTime = new Date(now.getTime() - timeOffset);
    
    const rootEvent = {
        id: eventIdCounter++,
        timelineId: timelineId,
        parentId: null,
        time: rootTime,
        title: `Дерево ${eventIdCounter} (корень)`,
        description: `Корневое событие дерева`,
        data: {
            type: 'Корень дерева',
            priority: 'Высокий',
            status: 'Активно',
            value: Math.floor(Math.random() * 1000),
            category: `Категория ${Math.floor(Math.random() * 5) + 1}`
        }
    };
    events.push(rootEvent);
    
    // Create 3-7 child events in a tree structure
    const childCount = Math.floor(Math.random() * 5) + 3;
    let parentEvent = rootEvent;
    
    for (let c = 0; c < childCount; c++) {
        const childTime = new Date(parentEvent.time.getTime() + (Math.random() * 86400000 * 2));
        const childEvent = {
            id: eventIdCounter++,
            timelineId: timelineId,
            parentId: parentEvent.id,
            time: childTime,
            title: `Подсобытие ${eventIdCounter}`,
            description: `Это подсобытие привязано к "${parentEvent.title}"`,
            data: {
                type: 'Подсобытие',
                priority: ['Низкий', 'Средний', 'Высокий'][Math.floor(Math.random() * 3)],
                status: 'Активно',
                value: Math.floor(Math.random() * 500),
                parentTitle: parentEvent.title,
                level: c + 1
            }
        };
        events.push(childEvent);
        
        // 60% chance to continue the chain from this event
        if (Math.random() < 0.6) {
            parentEvent = childEvent;
        }
    }
    
    renderChart();
}

// Show event details in modal
function showEventDetails(event) {
    const modal = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    title.textContent = event.title;
    
    let childEvents = events.filter(e => e.parentId === event.id);
    let childrenHTML = '';
    
    if (childEvents.length > 0) {
        childrenHTML = `
            <div class="event-tree">
                <h4>Дочерние события (${childEvents.length}):</h4>
                ${childEvents.map(child => `
                    <div class="tree-item">${child.title}</div>
                `).join('')}
            </div>
        `;
    }
    
    body.innerHTML = `
        <div class="data-card">
            <h3>Основная информация</h3>
            <div class="data-row">
                <span class="data-label">Время:</span>
                <span class="data-value">${event.time.toLocaleString('ru-RU')}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Описание:</span>
                <span class="data-value">${event.description}</span>
            </div>
            <div class="data-row">
                <span class="data-label">Линия:</span>
                <span class="data-value">${timelines.find(t => t.id === event.timelineId)?.name}</span>
            </div>
        </div>
        
        <div class="data-card">
            <h3>Данные объекта</h3>
            ${Object.entries(event.data).map(([key, value]) => `
                <div class="data-row">
                    <span class="data-label">${key}:</span>
                    <span class="data-value">${value}</span>
                </div>
            `).join('')}
        </div>
        
        ${childrenHTML}
    `;
    
    modal.classList.add('active');
}

// Show cluster details in modal
function showClusterDetails(cluster) {
    const modal = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    title.textContent = `Кластер событий (${cluster.length})`;
    
    body.innerHTML = `
        <div class="data-card">
            <h3>События в кластере</h3>
            ${cluster.map((event, index) => `
                <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                    <div class="data-row">
                        <span class="data-label"><strong>${index + 1}. ${event.title}</strong></span>
                        <span class="data-value">${formatDate(event.time)}</span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">Время:</span>
                        <span class="data-value">${event.time.toLocaleString('ru-RU')}</span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">Описание:</span>
                        <span class="data-value">${event.description}</span>
                    </div>
                    <button class="btn btn-primary" style="margin-top: 10px; font-size: 12px; padding: 5px 10px;" 
                            onclick="showEventDetails(events.find(e => e.id === ${event.id}))">
                        Подробнее
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    
    modal.classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// Update zoom info display
function updateZoomInfo() {
    const zoomPercent = Math.round(currentZoom * 100);
    document.getElementById('zoomInfo').textContent = 
        `Масштаб: ${zoomPercent}% | Событий: ${events.length} | Линий: ${timelines.length}`;
}

// Close modal on overlay click
document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// Initialize on load
window.addEventListener('load', init);
