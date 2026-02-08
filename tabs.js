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
        { href: 'index.html', text: 'Atom Simulator' },
        { href: 'single.html', text: 'Single Orbital' },
        { href: 'grid.html', text: 'Atoms Grid' },
        { href: 'molecules.html', text: 'Molecules' }
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
    controls.appendChild(pauseBox.label);
    controls.appendChild(lowBox.label);

    // Determine which controls to show based on the current page
    const path = location.pathname;
    const page = path.split('/').pop() || 'index.html';

    // Hide standard controls (Pause, Low CPU) for static views that don't animate (like Molecules)
    const isStaticView = (page === 'molecules.html' || page === 'grid.html');

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
    // Expose a simple API to toggle programmatically
    window.APP = {
        setPaused(v){ window.APP_STATE.paused = !!v; pauseBox.cb.checked = !!v; },
        setLowQuality(v){ window.APP_STATE.lowQuality = !!v; lowBox.cb.checked = !!v; }
    };

})();
