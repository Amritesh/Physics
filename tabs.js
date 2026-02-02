// Global app state and top navigation + processing controls
(function(){
    if (!window.APP_STATE) window.APP_STATE = {};
    window.APP_STATE.paused = false;
    window.APP_STATE.lowQuality = false;
    window.APP_STATE.detectionEnabled = true;
    window.APP_STATE.showGhosts = true;
    window.APP_STATE.timeScale = 0.5; // 0..1, larger = longer persistence / denser cloud


    const nav = document.createElement('div');
    nav.id = 'app-tabs';

    const pages = [
        { href: 'index.html', text: 'Single Atom' },
        { href: 'grid.html', text: 'Atoms Grid' },
        { href: 'atoms20.html', text: 'Atoms (Time)' },
        { href: 'molecules.html', text: 'Molecules' },
        { href: 'molecules20.html', text: 'Molecules (Time)' }
    ];

    pages.forEach(p => {
        const a = document.createElement('a');
        a.href = p.href;
        a.textContent = p.text;
        if (location.pathname.endsWith(p.href) || location.pathname === ('/' + p.href)) a.classList.add('active');
        nav.appendChild(a);
    });

    const controls = document.createElement('div');
    controls.className = 'controls';

    function makeCheckbox(id, labelText, initial) {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = id;
        cb.checked = initial;
        const span = document.createElement('span');
        span.textContent = labelText;
        label.appendChild(cb);
        label.appendChild(span);
        return { label, cb };
    }

    const pauseBox = makeCheckbox('app-pause', 'Pause', window.APP_STATE.paused);
    const lowBox = makeCheckbox('app-lowq', 'Low CPU', window.APP_STATE.lowQuality);
    const detectBox = makeCheckbox('app-detect', 'Detections', window.APP_STATE.detectionEnabled);
    const ghostBox = makeCheckbox('app-ghost', 'Ghosts', window.APP_STATE.showGhosts);

    controls.appendChild(pauseBox.label);
    controls.appendChild(lowBox.label);
    controls.appendChild(detectBox.label);
    controls.appendChild(ghostBox.label);

    // Time scale slider
    const timeWrap = document.createElement('label');
    const timeRange = document.createElement('input');
    timeRange.type = 'range';
    timeRange.min = 0.0;
    timeRange.max = 1.0;
    timeRange.step = 0.01;
    timeRange.value = window.APP_STATE.timeScale;
    timeRange.id = 'app-timescale';
    const timeLabel = document.createElement('span');
    timeLabel.className = 'time-label';
    timeLabel.textContent = 'Time: ' + timeRange.value;
    timeWrap.appendChild(timeRange);
    timeWrap.appendChild(timeLabel);
    controls.appendChild(timeWrap);

    // Add scale info display
    const scaleInfo = document.createElement('div');
    scaleInfo.className = 'scale-info';
    scaleInfo.id = 'scale-info-display';
    scaleInfo.style.maxWidth = '200px';
    scaleInfo.textContent = '1 unit = 8 a₀ | Obs: 0.17 fs';
    nav.appendChild(scaleInfo);

    // Determine which controls to show based on the current page
    const path = location.pathname;
    const page = path.split('/').pop() || 'index.html';
    // Show advanced controls (Time, Detections, Ghosts) only for Time/Overlay views
    const isTimeView = page.includes('20.html') || page.includes('Time');
    // Hide standard controls (Pause, Low CPU) for static views that don't animate (like Molecules)
    const isStaticView = (page === 'molecules.html');

    if (!isTimeView) {
        detectBox.label.style.display = 'none';
        ghostBox.label.style.display = 'none';
        timeWrap.style.display = 'none';
        scaleInfo.style.display = 'none';
    }

    if (isStaticView) {
        pauseBox.label.style.display = 'none';
        lowBox.label.style.display = 'none';
    }

    nav.appendChild(controls);
    document.body.appendChild(nav);

    // Wire events
    pauseBox.cb.addEventListener('change', () => {
        window.APP_STATE.paused = pauseBox.cb.checked;
    });
    lowBox.cb.addEventListener('change', () => {
        window.APP_STATE.lowQuality = lowBox.cb.checked;
    });
    detectBox.cb.addEventListener('change', () => {
        window.APP_STATE.detectionEnabled = detectBox.cb.checked;
    });
    ghostBox.cb.addEventListener('change', () => {
        window.APP_STATE.showGhosts = ghostBox.cb.checked;
    });
    timeRange.addEventListener('input', () => {
        const v = parseFloat(timeRange.value);
        window.APP_STATE.timeScale = v;
        timeLabel.textContent = 'Time: ' + v.toFixed(2);
        // Update scale info if formatScales is available
        if (window.updateScaleDisplay) {
            window.updateScaleDisplay(v);
        }
    });

    // Expose a simple API to toggle programmatically
    window.APP = {
        setPaused(v){ window.APP_STATE.paused = !!v; pauseBox.cb.checked = !!v; },
        setLowQuality(v){ window.APP_STATE.lowQuality = !!v; lowBox.cb.checked = !!v; },
        setDetections(v){ window.APP_STATE.detectionEnabled = !!v; detectBox.cb.checked = !!v; },
        setGhosts(v){ window.APP_STATE.showGhosts = !!v; ghostBox.cb.checked = !!v; },
        setTimeScale(v){ window.APP_STATE.timeScale = Math.max(0, Math.min(1, v)); timeRange.value = window.APP_STATE.timeScale; timeLabel.textContent = 'Time: ' + window.APP_STATE.timeScale.toFixed(2); }
    };

})();
