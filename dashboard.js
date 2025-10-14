/******************************************************************
 * Dashboard Admin + GitHub Push + Auto-fetch
 ******************************************************************/

// Load config.js first in HTML: <script src="config.js"></script>

const JSON_URL = './dashboard-data.json';
let dashboardData = {
    settings: { gymName: "YMCA of Saskatoon", rotationSpeed: 4, mediaRotationSpeed: 8 },
    media: [], weekly_schedule: {}, classes: [], announcements: []
};

let currentAnnouncement = 0;
let currentMedia = 0;
let rotationInterval = null;
let mediaInterval = null;

// ----------------- INIT -----------------
document.addEventListener('DOMContentLoaded', initDashboard);

async function initDashboard() {
    await loadJSONData();
    loadLocalData();
    renderAll();
    startAnnouncementRotation();
    startMediaRotation();
    updateDateTime();
    updateWeather();
    setInterval(updateDateTime, 1000);
    setInterval(updateWeather, 300_000); // 5 min

    // auto-fetch GitHub every 5 minutes
    if (typeof GITHUB_USERNAME !== 'undefined') {
        setInterval(fetchFromGitHub, 300_000);
    }
}

// ----------------- LOAD JSON -----------------
async function loadJSONData() {
    try {
        const res = await fetch(JSON_URL, { cache: "no-store" });
        if (!res.ok) throw new Error('Fetch failed: ' + res.status);
        const json = await res.json();
        Object.assign(dashboardData.settings, json.settings || {});
        dashboardData.media = Array.isArray(json.media) ? [...json.media] : [];
        dashboardData.weekly_schedule = json.weekly_schedule || {};
        dashboardData.classes = Array.isArray(json.classes) ? [...json.classes] : [];
        dashboardData.announcements = Array.isArray(json.announcements) ? [...json.announcements] : [];
        const gymDisplay = document.getElementById('gymNameDisplay');
        if (gymDisplay) gymDisplay.textContent = dashboardData.settings.gymName || '';
    } catch (err) {
        console.error('Error loading JSON:', err);
    }
}

// ----------------- LOCAL STORAGE -----------------
function loadLocalData() {
    const saved = localStorage.getItem('ymcaDashboardData');
    if (!saved) {
        dashboardData.classes = getTodaysClasses();
        return;
    }
    try {
        const parsed = JSON.parse(saved);
        dashboardData.classes = [...getTodaysClasses(), ...(parsed.classes || [])];
        if (Array.isArray(parsed.announcements)) dashboardData.announcements = [...dashboardData.announcements, ...parsed.announcements];
    } catch (e) {
        console.warn('Invalid localStorage data:', e);
        dashboardData.classes = getTodaysClasses();
    }
}

function saveLocalData() {
    const payload = {
        classes: dashboardData.classes.filter(c => !c.fromSchedule),
        announcements: dashboardData.announcements.filter(a => !a.permanent)
    };
    localStorage.setItem('ymcaDashboardData', JSON.stringify(payload));
}

// ----------------- GITHUB PUSH -----------------
async function pushToGitHub() {
    if (typeof GITHUB_USERNAME === 'undefined' || !GITHUB_TOKEN) return;

    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/dashboard-data.json`;

    try {
        // get current sha
        const getRes = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });
        const data = await getRes.json();
        const sha = data.sha;

        const content = btoa(JSON.stringify({
            settings: dashboardData.settings,
            media: dashboardData.media,
            weekly_schedule: dashboardData.weekly_schedule,
            classes: dashboardData.classes.filter(c => !c.fromSchedule),
            announcements: dashboardData.announcements.filter(a => !a.permanent)
        }));

        const commitRes = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Dashboard admin update',
                content: content,
                sha: sha,
                branch: GITHUB_BRANCH
            })
        });
        const result = await commitRes.json();
        console.log('GitHub push result:', result);
    } catch (e) {
        console.error('Error pushing to GitHub:', e);
    }
}

// ----------------- AUTO FETCH FROM GITHUB -----------------
async function fetchFromGitHub() {
    if (typeof GITHUB_USERNAME === 'undefined') return;

    const url = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/dashboard-data.json`;
    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error('GitHub fetch failed ' + res.status);
        const json = await res.json();
        dashboardData.settings = { ...dashboardData.settings, ...(json.settings || {}) };
        dashboardData.media = Array.isArray(json.media) ? [...json.media] : [];
        dashboardData.weekly_schedule = json.weekly_schedule || {};
        dashboardData.classes = Array.isArray(json.classes) ? [...json.classes] : [];
        dashboardData.announcements = Array.isArray(json.announcements) ? [...json.announcements] : [];
        renderAll();
    } catch (e) {
        console.warn('Auto-fetch error:', e);
    }
}

// ----------------- ADMIN ACTION OVERRIDES -----------------
function addClass(e){e.preventDefault();
    const name=document.getElementById('className').value.trim();
    const time=document.getElementById('classTime').value.trim();
    const location=document.getElementById('classLocation').value.trim();
    const instructor=document.getElementById('classInstructor').value.trim();
    const cancelled=document.getElementById('classCancelled').checked;
    if(!name) return alert('Enter class name');
    const newClass={id:Date.now().toString(),name,time,location,instructor,cancelled,fromSchedule:false};
    dashboardData.classes.push(newClass);
    saveLocalData();
    renderClasses();
    renderAdminTables();
    clearClassForm();
    showSuccess();
    pushToGitHub();
}

function removeClass(id){dashboardData.classes=dashboardData.classes.filter(c=>c.id!==id);saveLocalData();renderClasses();renderAdminTables();showSuccess();pushToGitHub();}
function toggleClassCancellation(id){const c=dashboardData.classes.find(x=>x.id===id);if(!c)return;c.cancelled=!c.cancelled;saveLocalData();renderClasses();renderAdminTables();showSuccess();pushToGitHub();}
function updateClass(e,id){e.preventDefault();const c=dashboardData.classes.find(x=>x.id===id);if(!c)return;c.name=document.getElementById('className').value.trim();c.time=document.getElementById('classTime').value.trim();c.location=document.getElementById('classLocation').value.trim();c.instructor=document.getElementById('classInstructor').value.trim();c.cancelled=document.getElementById('classCancelled').checked;saveLocalData();renderClasses();renderAdminTables();clearClassForm();showSuccess();pushToGitHub();}
function addAnnouncement(e){e.preventDefault();const title=document.getElementById('announcementTitle').value.trim();const message=document.getElementById('announcementMessage').value.trim();const details=document.getElementById('announcementDetails').value.trim();const severity=document.getElementById('announcementSeverity').value;if(!title||!message) return alert('Title and message required');const ann={id:Date.now(),title,message,details,severity,permanent:false};dashboardData.announcements.push(ann);saveLocalData();renderAnnouncements();renderAdminTables();clearAnnouncementForm();startAnnouncementRotation();showSuccess();pushToGitHub();}
function removeAnnouncement(id){const ann=dashboardData.announcements.find(a=>a.id===id);if(!ann)return;if(ann.permanent)return alert('Cannot delete permanent announcement from admin (edit JSON instead).');dashboardData.announcements=dashboardData.announcements.filter(a=>a.id!==id);saveLocalData();renderAnnouncements();renderAdminTables();startAnnouncementRotation();showSuccess();pushToGitHub();}

// ----------------- EVERYTHING ELSE -----------------
// Keep all your current dashboard functions: renderClasses(), renderAnnouncements(), renderAll(), startAnnouncementRotation(), startMediaRotation(), updateDateTime(), updateWeather(), scaleSidebarContent(), escapeHtml(), etc.

// Make sure all existing HTML calls remain unchanged
window.addClass=addClass;
window.removeClass=removeClass;
window.toggleClassCancellation=toggleClassCancellation;
window.updateClass=updateClass;
window.addAnnouncement=addAnnouncement;
window.removeAnnouncement=removeAnnouncement;
window.clearClassForm=clearClassForm;
window.clearAnnouncementForm=clearAnnouncementForm;
window.resetData=resetData;
