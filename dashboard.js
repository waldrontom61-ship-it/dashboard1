/******************************************************************
 * Full Dashboard Script with GitHub Integration
 * - Auto-fetches JSON from GitHub
 * - Admin edits update GitHub JSON
 * - Auto-refresh for TV/Desktop
 * - Supports classes, announcements, media, and weather
 ******************************************************************/

// ---------------- CONFIG ----------------
const GITHUB_OWNER = 'waldrontom61-ship-it';
const GITHUB_REPO = 'dashboard1';
const FILE_PATH = 'dashboard-data.json';
const GITHUB_TOKEN = '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'; // keep secret

let dashboardData = {
    settings: { gymName: "YMCA of Saskatoon", rotationSpeed: 4, mediaRotationSpeed: 8 },
    media: [],
    weekly_schedule: {},
    classes: [],
    announcements: []
};

let currentAnnouncement = 0;
let currentMedia = 0;
let rotationInterval = null;
let mediaInterval = null;

// ---------------- INIT ----------------
document.addEventListener('DOMContentLoaded', initDashboard);

async function initDashboard() {
    await loadJSONData();
    renderAllAndScale();
    startAnnouncementRotation();
    startMediaRotation();
    updateDateTime();
    updateWeather();
    setInterval(updateDateTime, 1000);
    setInterval(updateWeather, 300_000); // 5 min
    setInterval(autoFetchUpdates, 30_000); // auto-fetch every 30s
}

// ---------------- AUTO-FETCH ----------------
async function autoFetchUpdates() {
    console.log('Auto-fetching latest JSON from GitHub...');
    await loadJSONData();
}

// ---------------- GITHUB FETCH ----------------
async function loadJSONData() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
        const res = await fetch(url, {
            headers: { 
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3.raw'
            }
        });
        if (!res.ok) throw new Error('Fetch failed: ' + res.status);
        const json = await res.json();
        dashboardData = json;
        // Apply today's classes if schedule exists
        dashboardData.classes = getTodaysClasses().concat(dashboardData.classes.filter(c => !c.fromSchedule));
        renderAllAndScale();
        console.log('Loaded JSON from GitHub');
    } catch (err) {
        console.error('Error loading JSON:', err);
    }
}

// ---------------- GITHUB SAVE ----------------
async function saveJSONToGitHub() {
    try {
        const getRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        const data = await getRes.json();
        const sha = data.sha;

        const content = btoa(unescape(encodeURIComponent(JSON.stringify(dashboardData, null, 2))));

        const putRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`, {
            method: 'PUT',
            headers: { 
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: "Dashboard update via admin panel",
                content: content,
                sha: sha
            })
        });
        if (!putRes.ok) throw new Error('GitHub update failed: ' + putRes.status);
        console.log('Dashboard JSON updated on GitHub');
    } catch (e) {
        console.error('Error saving JSON to GitHub:', e);
    }
}

// ---------------- TODAY'S CLASSES ----------------
function getTodaysClasses() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Regina' }));
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    const todaysSchedule = dashboardData.weekly_schedule[weekday] || [];
    return todaysSchedule.map((item, idx) => ({
        id: `schedule_${weekday}_${idx}`,
        name: item.event || '',
        time: item.time || '',
        location: item.location || '',
        instructor: item.instructor || '',
        cancelled: false,
        fromSchedule: true
    }));
}

// ---------------- DATE / TIME ----------------
function updateDateTime() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Regina' }));
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('en-US', timeOptions);
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', dateOptions);
}

// ---------------- WEATHER ----------------
async function updateWeather() {
    try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=52.1332&longitude=-106.6700&current_weather=true';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather fetch failed ' + res.status);
        const data = await res.json();
        if (data && data.current_weather) {
            const temp = Math.round(data.current_weather.temperature);
            const code = data.current_weather.weathercode;
            document.getElementById('weather-temp').textContent = `${temp}°C`;
            document.getElementById('weather-icon').textContent = getWeatherIcon(code);
        } else throw new Error('No current_weather in response');
    } catch (e) {
        console.warn('Weather error:', e);
        document.getElementById('weather-temp').textContent = '--°C';
        document.getElementById('weather-icon').textContent = '⛅';
    }
}

function getWeatherIcon(code) {
    const map = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌦️',56:'🌨️',57:'🌨️',
                 61:'🌧️',63:'🌧️',65:'🌧️',66:'🌨️',67:'🌨️',71:'❄️',73:'❄️',75:'❄️',77:'❄️',
                 80:'🌦️',81:'🌧️',82:'🌧️',85:'🌨️',86:'🌨️',95:'⛈️',96:'⛈️',99:'⛈️'};
    return map[code] || '⛅';
}

// ---------------- RENDER ----------------
function renderAll() {
    renderMedia();
    renderClasses();
    renderAnnouncements();
    renderAdminTables();
}

// ---------------- MEDIA ----------------
function renderMedia() {
    const container = document.getElementById('media-container');
    container.innerHTML = '';
    if (!dashboardData.media.length) {
        container.innerHTML = `<div class="demo-content"><div class="demo-title">70% CONTENT AREA</div><div class="demo-subtitle">Main media/image content goes here</div><div style="font-size:4rem;margin-top:2rem;">🖼️</div></div>`;
        return;
    }
    dashboardData.media.forEach((m, idx) => {
        const slide = document.createElement('div');
        slide.className = 'media-slide' + (idx === 0 ? ' active' : '');
        slide.dataset.index = idx;
        if (m.type === 'video') {
            const video = document.createElement('video');
            video.src = m.src;
            video.autoplay = video.loop = video.muted = true;
            video.playsInline = true;
            video.style.width = video.style.height = '100%';
            video.style.objectFit = 'cover';
            slide.appendChild(video);
        } else if (m.type === 'youtube') {
            const iframe = document.createElement('iframe');
            iframe.src = `${m.src}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${extractYouTubeID(m.src)}`;
            iframe.allow = 'autoplay; fullscreen';
            iframe.frameBorder = 0;
            iframe.style.width = iframe.style.height = '100%';
            slide.appendChild(iframe);
        } else {
            const img = document.createElement('img');
            img.src = m.src; img.alt = 'Media';
            img.onerror = () => img.style.display = 'none';
            slide.appendChild(img);
        }
        container.appendChild(slide);
    });
}

function extractYouTubeID(url) {
    const match = url.match(/(?:\/embed\/|v=)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
}

function startMediaRotation() {
    if (mediaInterval) clearInterval(mediaInterval);
    const slides = document.querySelectorAll('.media-slide');
    if (!slides.length || slides.length <= 1) return;
    currentMedia = 0;
    slides.forEach((s, i) => s.style.display = i === 0 ? 'block' : 'none');
    mediaInterval = setInterval(() => {
        slides[currentMedia].style.display = 'none';
        currentMedia = (currentMedia + 1) % slides.length;
        slides[currentMedia].style.display = 'block';
    }, dashboardData.settings.mediaRotationSpeed * 1000);
}

// ---------------- ANNOUNCEMENTS ----------------
function renderAnnouncements() {
    const container = document.getElementById('announcement-container');
    container.innerHTML = '';
    if (!dashboardData.announcements.length) {
        container.innerHTML = '<div class="info-card good-announcement"><div class="card-title">Welcome to YMCA!</div><div class="card-subtitle">Have a great workout today</div></div>';
        return;
    }
    dashboardData.announcements.forEach((a, idx) => {
        const div = document.createElement('div');
        const severity = a.severity || 'good';
        div.className = `announcement-slide ${severity}-announcement ${idx === 0 ? 'active' : ''}`;
        div.innerHTML = `<div class="card-title">${escapeHtml(a.title)}</div><div class="card-subtitle">${escapeHtml(a.message)}</div><div class="card-meta">${escapeHtml(a.details||'')}</div>`;
        container.appendChild(div);
    });
}

function startAnnouncementRotation() {
    if(rotationInterval) clearInterval(rotationInterval);
    const slides = document.querySelectorAll('.announcement-slide');
    if(slides.length <= 1) return;
    currentAnnouncement=0;
    const speed = 4000;
    rotationInterval = setInterval(()=>{
        const slidesNow = document.querySelectorAll('.announcement-slide');
        slidesNow[currentAnnouncement].classList.remove('active');
        currentAnnouncement=(currentAnnouncement+1)%slidesNow.length;
        slidesNow[currentAnnouncement].classList.add('active');
    }, speed);
}

// ---------------- CLASSES ----------------
function renderClasses() {
    const container = document.getElementById('classes-container');
    container.innerHTML = '';
    if (!dashboardData.classes.length) {
        container.innerHTML = '<div class="info-card"><div class="card-title">No classes scheduled for today</div></div>';
        return;
    }
    dashboardData.classes.forEach(c=>{
        const card = document.createElement('div');
        card.className = c.cancelled ? 'info-card cancelled-class' : 'info-card';
        let inner = `<div class="card-title">${escapeHtml(c.name)}</div><div class="card-subtitle">${escapeHtml(c.time)} - ${escapeHtml(c.location||'')}</div><div class="card-meta">Instructor: ${escapeHtml(c.instructor||'')}</div>`;
        if(c.cancelled) inner += `<div class="cancelled-badge">CANCELLED</div>`;
        card.innerHTML = inner;
        container.appendChild(card);
    });
}

// ---------------- ADMIN PANEL ----------------
function renderAdminTables() {
    // Classes table
    const classesTbl = document.getElementById('classes-table');
    classesTbl.innerHTML = '';
    dashboardData.classes.forEach(c => {
        const tr = document.createElement('tr');
        const statusBadge = c.cancelled ? '<span class="severity-badge severity-urgent">Cancelled</span>' : '<span class="severity-badge severity-good">Active</span>';
        const toggleBtn = `<button class="btn" style="background:#f59e0b;color:white;" onclick="toggleClassCancellation('${c.id}')">${c.cancelled?'Reactivate':'Cancel'}</button>`;
        const editBtn = c.fromSchedule ? '' : `<button class="btn btn-secondary" style="background:#059669;" onclick="editClass('${c.id}')">Edit</button>`;
        const deleteBtn = c.fromSchedule ? '' : `<button class="btn btn-danger" onclick="removeClass('${c.id}')">Delete</button>`;
        tr.innerHTML = `<td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.time)}</td><td>${escapeHtml(c.location||'')}</td><td>${escapeHtml(c.instructor||'')}</td><td>${statusBadge}</td><td>${toggleBtn} ${editBtn} ${deleteBtn}</td>`;
        classesTbl.appendChild(tr);
    });

    // Announcements table
    const annTbl = document.getElementById('announcements-table');
    annTbl.innerHTML = '';
    dashboardData.announcements.forEach(a => {
        const tr = document.createElement('tr');
        const deleteBtn = a.permanent ? '<span style="color:#6b7280;font-style:italic;">Permanent</span>' : `<button class="btn btn-danger" onclick="removeAnnouncement(${a.id})">Delete</button>`;
        tr.innerHTML = `<td>${escapeHtml(a.title||'')}</td><td>${escapeHtml(a.message||'')}</td><td><span class="severity-badge severity-${a.severity||'good'}">${escapeHtml(a.severity||'')}</span></td><td>${deleteBtn}</td>`;
        annTbl.appendChild(tr);
    });
}

// ---------------- ADMIN ACTIONS ----------------
function addClass(e){e.preventDefault();
    const name=document.getElementById('className').value.trim();
    const time=document.getElementById('classTime').value.trim();
    const location=document.getElementById('classLocation').value.trim();
    const instructor=document.getElementById('classInstructor').value.trim();
    const cancelled=document.getElementById('classCancelled').checked;
    if(!name) return alert('Enter class name');
    const newClass={id:Date.now().toString(),name,time,location,instructor,cancelled,fromSchedule:false};
    dashboardData.classes.push(newClass);
    saveJSONToGitHub();
    renderClasses(); renderAdminTables(); clearClassForm(); showSuccess();
}
function removeClass(id){dashboardData.classes=dashboardData.classes.filter(c=>c.id!==id); saveJSONToGitHub(); renderClasses(); renderAdminTables(); showSuccess();}
function toggleClassCancellation(id){const c=dashboardData.classes.find(x=>x.id===id);if(!c)return;c.cancelled=!c.cancelled; saveJSONToGitHub(); renderClasses(); renderAdminTables(); showSuccess();}
function editClass(id){const c=dashboardData.classes.find(x=>x.id===id);if(!c)return;
    document.getElementById('className').value=c.name;
    document.getElementById('classTime').value=c.time;
    document.getElementById('classLocation').value=c.location;
    document.getElementById('classInstructor').value=c.instructor;
    document.getElementById('classCancelled').checked=c.cancelled;
    const form=document.getElementById('class-form');
    form.onsubmit=function(ev){updateClass(ev,id);};
    form.querySelector('button[type="submit"]').textContent='Update Class';
}
function updateClass(e,id){e.preventDefault();const c=dashboardData.classes.find(x=>x.id===id);if(!c)return;
    c.name=document.getElementById('className').value.trim();
    c.time=document.getElementById('classTime').value.trim();
    c.location=document.getElementById('classLocation').value.trim();
    c.instructor=document.getElementById('classInstructor').value.trim();
    c.cancelled=document.getElementById('classCancelled').checked;
    saveJSONToGitHub();
    renderClasses(); renderAdminTables(); clearClassForm(); showSuccess();
}
function clearClassForm(){const form=document.getElementById('class-form'); form.reset(); form.onsubmit=addClass; form.querySelector('button[type="submit"]').textContent='Add Class';}

function addAnnouncement(e){e.preventDefault();
    const title=document.getElementById('announcementTitle').value.trim();
    const message=document.getElementById('announcementMessage').value.trim();
    const details=document.getElementById('announcementDetails').value.trim();
    const severity=document.getElementById('announcementSeverity').value;
    if(!title||!message) return alert('Title and message required');
    const ann={id:Date.now(),title,message,details,severity,permanent:false};
    dashboardData.announcements.push(ann);
    saveJSONToGitHub();
    renderAnnouncements(); renderAdminTables(); clearAnnouncementForm(); startAnnouncementRotation(); showSuccess();
}
function removeAnnouncement(id){const ann=dashboardData.announcements.find(a=>a.id===id);if(!ann)return;if(ann.permanent)return alert('Cannot delete permanent announcement'); dashboardData.announcements=dashboardData.announcements.filter(a=>a.id!==id); saveJSONToGitHub(); renderAnnouncements(); renderAdminTables(); startAnnouncementRotation(); showSuccess();}
function clearAnnouncementForm(){document.getElementById('announcement-form').reset();}

// ---------------- UI HELPERS ----------------
function toggleAdmin(){const panel=document.getElementById('adminPanel');panel.style.display=(panel.style.display==='block')?'none':'block';}
function switchTab(name){document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));event.target.classList.add('active');document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));const el=document.getElementById(name+'-section');if(el)el.classList.add('active');}
function showSuccess(){const el=document.getElementById('success-message');if(!el)return;el.style.display='block';setTimeout(()=>el.style.display='none',2500);}
function escapeHtml(s){if(!s&&s!==0)return'';return String(s).replace(/[&<>"'`=\/]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c]));}

// ---------------- SCALE SIDEBAR ----------------
function scaleSidebarContent() {
    const sidebar = document.querySelector('.sidebar-overlay');
    const header = document.querySelector('.sidebar-header');
    const footer = document.querySelector('.sidebar-footer');
    const content = document.querySelector('.content-section');
    if (!sidebar || !header || !footer || !content) return;
    const availableHeight = sidebar.clientHeight - header.offsetHeight - footer.offsetHeight - 10;
    const contentHeight = content.scrollHeight;
    const scale = Math.min(1, availableHeight / contentHeight);
    content.style.transformOrigin = 'top';
    content.style.transform = `scale(${scale})`;
}
window.addEventListener('load', scaleSidebarContent);
window.addEventListener('resize', scaleSidebarContent);

// ---------------- RENDER & SCALE ----------------
function renderAllAndScale(){ renderAll(); scaleSidebarContent(); }

// ---------------- OVERRIDE RENDER ----------------
const origRenderClasses = renderClasses;
renderClasses = function() { origRenderClasses(); scaleSidebarContent(); };
const origRenderAnnouncements = renderAnnouncements;
renderAnnouncements = function() { origRenderAnnouncements(); scaleSidebarContent(); };

// ---------------- EXPOSE GLOBALS ----------------
window.toggleAdmin=toggleAdmin;
window.switchTab=switchTab;
window.addClass=addClass;
window.clearClassForm=clearClassForm;
window.editClass=editClass;
window.removeClass=removeClass;
window.toggleClassCancellation=toggleClassCancellation;
window.updateClass=updateClass;
window.addAnnouncement=addAnnouncement;
window.clearAnnouncementForm=clearAnnouncementForm;
window.removeAnnouncement=removeAnnouncement;
