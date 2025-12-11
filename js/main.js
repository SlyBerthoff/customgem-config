// js/main.js
import { mdeInstances, getNextColorSet, resetColorIndex } from './config.js';
import { createPillar, createSubsection } from './ui.js';
import { showToast, getTimestamp } from './utils.js';
import * as Drive from './drive.js';

// ============================================================
// CONFIGURATION GOOGLE DRIVE
const GOOGLE_CLIENT_ID = "912917090028-6jmainstltc8q129h6hlsa026ik2boei.apps.googleusercontent.com"; 
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    try {
        const pillarsContainer = document.getElementById('pillars-container');
        const mainTitleInput = document.getElementById('main-title');

        if (!pillarsContainer) throw new Error("Container principal introuvable.");

        // --- Init Drive ---
        if (GOOGLE_CLIENT_ID) {
            localStorage.setItem('google_client_id', GOOGLE_CLIENT_ID);
            Drive.initTokenClient(GOOGLE_CLIENT_ID);
        }

        function attach(id, event, handler) {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        }

        // --- DARK MODE LOGIC ---
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        const isDarkMode = localStorage.getItem('forge_dark_mode') === 'true';
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            if(darkModeToggle) darkModeToggle.textContent = '☀️';
        }

        attach('dark-mode-toggle', 'click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('forge_dark_mode', isDark);
            darkModeToggle.textContent = isDark ? '☀️' : '🌙';
        });

        // --- SIDEBAR POSITION ---
        const body = document.body;
        const sidebar = document.getElementById('legend-sidebar');
        const legendIcon = document.getElementById('legend-pos-icon');
        const legendText = document.getElementById('legend-pos-text');
        let isLeft = true;

        attach('toggle-legend-pos-btn', 'click', () => {
            isLeft = !isLeft;
            if (isLeft) {
                body.classList.remove('legend-right'); body.classList.add('legend-left');
                sidebar.style.left = '0'; sidebar.style.right = 'auto';
                sidebar.style.borderRightWidth = '1px'; sidebar.style.borderLeftWidth = '0';
                legendIcon.textContent = "⬅";
                if(legendText) legendText.textContent = "Sidebar à Gauche";
            } else {
                body.classList.remove('legend-left'); body.classList.add('legend-right');
                sidebar.style.left = 'auto'; sidebar.style.right = '0';
                sidebar.style.borderLeftWidth = '1px'; sidebar.style.borderRightWidth = '0';
                legendIcon.textContent = "➡";
                if(legendText) legendText.textContent = "Sidebar à Droite";
            }
        });

        // --- GESTION CONNEXION DRIVE ---
        const loginBtn = document.getElementById('header-login-btn');
        const loginText = document.getElementById('login-status-text');
        const folderBtn = document.getElementById('header-folder-btn');
        const folderNameDisplay = document.getElementById('header-folder-name');

        let savedFolderName = localStorage.getItem('gem_drive_folder_name') || 'Dossier...';
        if(folderNameDisplay) folderNameDisplay.textContent = savedFolderName;

        document.addEventListener('drive-connected', () => {
            if(loginBtn && loginText) {
                loginText.textContent = "Compte Connecté";
                loginBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                loginBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            }
            if(folderBtn) {
                folderBtn.disabled = false;
                folderBtn.classList.remove('text-gray-400', 'cursor-not-allowed', 'border-gray-200');
                folderBtn.classList.add('text-gray-700', 'dark:text-white', 'hover:bg-gray-100', 'dark:hover:bg-gray-700', 'cursor-pointer', 'border-blue-300');
            }
        });

        attach('header-login-btn', 'click', () => {
            if(GOOGLE_CLIENT_ID) { Drive.initTokenClient(GOOGLE_CLIENT_ID); Drive.login(); }
        });

        // --- FOLDER PICKER ---
        attach('header-folder-btn', 'click', async () => {
            const modal = document.getElementById('folder-picker-modal');
            const list = document.getElementById('folder-list-container');
            modal.classList.remove('hidden');
            list.innerHTML = '<p class="text-center py-4">Chargement...</p>';
            
            const folders = await Drive.listFolders();
            list.innerHTML = '';
            
            const rootDiv = document.createElement('div');
            rootDiv.className = "p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700 flex items-center gap-2";
            rootDiv.innerHTML = "📁 <b>Racine</b>";
            rootDiv.onclick = () => selectFolder(null, "Racine");
            list.appendChild(rootDiv);

            folders.forEach(f => {
                const div = document.createElement('div');
                div.className = "p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700 flex items-center gap-2 text-sm";
                div.innerHTML = `📁 ${f.name}`;
                div.onclick = () => selectFolder(f.id, f.name);
                list.appendChild(div);
            });
        });

        function selectFolder(id, name) {
            if(id) localStorage.setItem('gem_drive_folder_id', id);
            else localStorage.removeItem('gem_drive_folder_id');
            localStorage.setItem('gem_drive_folder_name', name);
            if(folderNameDisplay) folderNameDisplay.textContent = name;
            document.getElementById('folder-picker-modal').classList.add('hidden');
        }

        attach('close-folder-picker', 'click', () => document.getElementById('folder-picker-modal').classList.add('hidden'));
        attach('create-app-folder-btn', 'click', async () => {
            const f = await Drive.createAppFolder("F.O.R.G.E. Projects");
            if(f) { selectFolder(f.id, f.name); showToast("Dossier créé !", "success"); }
        });

        // --- CORE LOGIC (Pillars) ---
        attach('add-pillar-btn', 'click', () => {
            const p = createPillar('Nouveau Pilier', getNextColorSet(), [{title:'Section 1', content:''}]);
            pillarsContainer.appendChild(p);
            p.scrollIntoView({behavior:'smooth'});
        });

        pillarsContainer.addEventListener('click', (e) => {
            if (e.target.closest('.drag-handle-pillar') || e.target.closest('.drag-handle-sub')) return;
            const toggleP = e.target.closest('.toggle-pillar-btn');
            if (toggleP) {
                toggleP.closest('.pillar-card').querySelector('.subsections-container').classList.toggle('is-closed');
                toggleP.querySelector('.toggle-icon').classList.toggle('is-closed');
                return;
            }
            const toggleS = e.target.closest('.toggle-subsection-btn');
            if (toggleS) {
                toggleS.closest('.subsection-card').querySelector('.subsection-content-wrapper').classList.toggle('is-closed');
                toggleS.querySelector('.toggle-icon').classList.toggle('is-closed');
                return;
            }
            const addSub = e.target.closest('.add-subsection-btn');
            if (addSub) {
                const card = addSub.closest('.pillar-card');
                const newSub = createSubsection('Nouvelle Section', '', JSON.parse(card.dataset.colorSet), false);
                card.querySelector('.subsections-container').appendChild(newSub);
                setTimeout(() => {
                    const id = newSub.querySelector('textarea').id;
                    if(mdeInstances.has(id)) mdeInstances.get(id).codemirror.focus();
                }, 200);
                return;
            }
            const delSub = e.target.closest('.delete-subsection-btn');
            if (delSub && confirm("Supprimer ?")) {
                const card = delSub.closest('.subsection-card');
                const id = card.querySelector('textarea').id;
                if(mdeInstances.has(id)) { mdeInstances.get(id).toTextArea(); mdeInstances.delete(id); }
                card.remove(); return;
            }
            const delPil = e.target.closest('.delete-pillar-btn');
            if (delPil && confirm("Supprimer ?")) {
                const card = delPil.closest('.pillar-card');
                card.querySelectorAll('textarea').forEach(t => { if(mdeInstances.has(t.id)) { mdeInstances.get(t.id).toTextArea(); mdeInstances.delete(t.id); } });
                card.remove(); return;
            }
        });

        // --- I/O ACTIONS ---
        attach('save-drive-btn', 'click', () => {
            const data = getDataAsObject();
            const safeTitle = (mainTitleInput.value || 'forge').replace(/[^a-z0-9]/gi, '-').toLowerCase();
            const fname = `${safeTitle}_${getTimestamp()}.json`;
            Drive.saveFile(data, fname, localStorage.getItem('gem_drive_folder_id'));
        });

        attach('load-drive-btn', 'click', async () => {
            if(!Drive.isConnected()) { showToast("Veuillez connecter votre compte", "error"); return; }
            const modal = document.getElementById('drive-modal');
            const list = document.getElementById('drive-file-list');
            modal.classList.remove('hidden');
            list.innerHTML = '<p class="text-center py-4">Chargement...</p>';
            const files = await Drive.listJsonFiles();
            list.innerHTML = '';
            files.forEach(f => {
                const div = document.createElement('div');
                div.className = "flex justify-between p-3 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer items-center dark:text-gray-200";
                div.innerHTML = `<span>${f.name}</span> <span class="text-xs text-gray-400">${new Date(f.modifiedTime).toLocaleDateString()}</span>`;
                div.onclick = async () => {
                    const content = await Drive.loadFileContent(f.id);
                    if(content) { rebuildUi(content); modal.classList.add('hidden'); }
                };
                list.appendChild(div);
            });
        });
        attach('close-drive-modal-btn', 'click', () => document.getElementById('drive-modal').classList.add('hidden'));

        attach('export-json-btn', 'click', () => {
            const blob = new Blob([JSON.stringify(getDataAsObject(), null, 2)], {type:'application/json'});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `forge_${getTimestamp()}.json`; a.click();
        });

        attach('import-json-btn', 'click', () => document.getElementById('json-file-input').click());
        attach('json-file-input', 'change', (e) => {
            const r = new FileReader();
            r.onload = (ev) => rebuildUi(JSON.parse(ev.target.result));
            r.readAsText(e.target.files[0]); e.target.value = '';
        });

        attach('export-md-btn', 'click', () => {
            let md = `# ${mainTitleInput.value}\n\n`;
            document.querySelectorAll('.pillar-card').forEach(p => {
                md += `## ${p.querySelector('.pillar-title').value}\n\n`;
                p.querySelectorAll('.subsection-card').forEach(s => {
                    const mde = mdeInstances.get(s.querySelector('textarea').id);
                    md += `### ${s.querySelector('.subsection-title').value}\n\n${mde ? mde.value() : ''}\n\n`;
                });
            });
            document.getElementById('markdown-output').textContent = md;
            document.getElementById('markdown-modal').classList.remove('hidden');
        });
        attach('close-md-modal-btn', 'click', () => document.getElementById('markdown-modal').classList.add('hidden'));
        attach('copy-md-btn', 'click', () => {
            navigator.clipboard.writeText(document.getElementById('markdown-output').textContent);
            showToast("Copié !", "success");
        });

        // --- Helpers ---
        function getDataAsObject() {
            return {
                mainTitle: mainTitleInput.value,
                pillars: Array.from(pillarsContainer.querySelectorAll('.pillar-card')).map(p => ({
                    title: p.querySelector('.pillar-title').value,
                    colorSet: JSON.parse(p.dataset.colorSet),
                    isClosed: p.querySelector('.subsections-container').classList.contains('is-closed'),
                    subsections: Array.from(p.querySelectorAll('.subsection-card')).map(s => ({
                        title: s.querySelector('.subsection-title').value,
                        content: mdeInstances.get(s.querySelector('textarea').id)?.value() || '',
                        isClosed: s.querySelector('.subsection-content-wrapper').classList.contains('is-closed')
                    }))
                }))
            };
        }

        function rebuildUi(data) {
            pillarsContainer.innerHTML = ''; mdeInstances.clear(); resetColorIndex();
            mainTitleInput.value = data.mainTitle || '';
            (data.pillars || []).forEach(p => {
                const col = p.colorSet || getNextColorSet();
                pillarsContainer.appendChild(createPillar(p.title, col, p.subsections || [], p.isClosed));
            });
        }

        new Sortable(pillarsContainer, { animation: 150, handle: '.drag-handle-pillar', ghostClass: 'sortable-ghost' });
        rebuildUi({
            mainTitle: "Nouveau Projet F.O.R.G.E.", 
            pillars: [{title:"Contexte", subsections:[{title:"Rôle", content:""}]}]
        });

    } catch (err) { console.error("FATAL ERROR in Main:", err); }
});