/**
 * js/app.js
 * Point d'entrée avec gestion Métadonnées & Obsolescence
 */
import { Config } from './config.js';
import { Auth } from './auth.js';
import { Drive } from './drive.js';
import { Editor } from './editor.js';

// --- DOM ELEMENTS ---
let btnConfigTrigger, btnNewProject, btnCloseEditor, btnSave;
let viewDashboard, viewEditor, emptyState, projectsGrid, folderIndicator;

// Nouveaux éléments pour l'archivage (à créer dynamiquement ou via update index.html si besoin)
// Pour simplifier sans toucher au HTML, on va ajouter un bouton "Archiver" dans la barre de l'éditeur en JS.

let currentFileId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements
    btnConfigTrigger = document.getElementById('btn-config'); 
    btnNewProject = document.getElementById('btn-new-project');
    btnCloseEditor = document.getElementById('btn-close-editor');
    btnSave = document.getElementById('btn-save');
    viewDashboard = document.getElementById('view-dashboard');
    viewEditor = document.getElementById('view-editor');
    emptyState = document.getElementById('empty-state');
    projectsGrid = document.getElementById('projects-grid');
    folderIndicator = document.getElementById('folder-indicator');

    // AJOUT DYNAMIQUE DU BOUTON ARCHIVER
    // On l'insère à gauche du bouton Sauvegarder
    const editorToolbar = btnSave.parentElement;
    const btnArchive = document.createElement('button');
    btnArchive.className = "mr-4 text-slate-400 hover:text-orange-600 text-sm font-medium transition";
    btnArchive.innerHTML = '<i class="fa-solid fa-box-archive mr-1"></i> <span id="lbl-archive">Archiver</span>';
    editorToolbar.insertBefore(btnArchive, btnSave);

    // 2. Init Modules
    Editor.init();

    // 3. CONFIGURATION & AUTH
    Config.initUI({
        onSave: () => {
            const conf = Config.get();
            if(folderIndicator) folderIndicator.textContent = "Dossier: " + (conf.folderName || "Racine");
            refreshProjects(); 
        },
        onLogin: () => {
            Auth.signIn(() => {
                Config.updateAuthStatus(true);
                updateAppUI(true);
                refreshProjects();
            });
        },
        onLogout: () => {
            Auth.signOut(() => {
                Config.updateAuthStatus(false);
                updateAppUI(false);
            });
        }
    });

    // 4. CHECK START
    if (!Config.hasConfig()) {
        Config.showModal(true);
    } else {
        Config.updateAuthStatus(false);
        Auth.init((success) => {
            if (success && Auth.isReady()) {
                Config.updateAuthStatus(true);
                updateAppUI(true);
                refreshProjects();
            }
            const conf = Config.get();
            if(folderIndicator) folderIndicator.textContent = "Dossier: " + (conf.folderName || "Racine");
        });
    }

    // --- LOGIC ---

    // Bouton ARCHIVER
    btnArchive.addEventListener('click', () => {
        const isObsolete = Editor.toggleObsolete();
        // Mise à jour visuelle du bouton
        if (isObsolete) {
            btnArchive.innerHTML = '<i class="fa-solid fa-box-open mr-1"></i> Restaurer';
            btnArchive.classList.add('text-orange-600');
        } else {
            btnArchive.innerHTML = '<i class="fa-solid fa-box-archive mr-1"></i> Archiver';
            btnArchive.classList.remove('text-orange-600');
        }
    });

    if(btnConfigTrigger) {
        btnConfigTrigger.addEventListener('click', () => {
            Config.updateAuthStatus(Auth.isReady()); 
            Config.showModal();
        });
    }

    btnNewProject.addEventListener('click', () => {
        currentFileId = null;
        // Template par défaut avec le bloc YAML vide
        Editor.setContent("---\ntitre_court: Nouveau Projet\nstatut: actif\n---\n\n# Nomenclature_FSA_XYZ\n\nContenu...");
        showEditor(true);
    });

    btnCloseEditor.addEventListener('click', () => {
        showEditor(false);
        if (Auth.isReady()) refreshProjects();
    });

    btnSave.addEventListener('click', async () => {
        const content = Editor.getContent();
        const fileName = Editor.extractTitle();
        
        // 1. On récupère les métadonnées du YAML pour les indexer dans Drive
        const meta = Editor.getMetadata();
        
        const originalText = btnSave.innerHTML;
        btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...';
        btnSave.disabled = true;

        try {
            const conf = Config.get();
            const targetFolder = conf ? conf.folderId : null;
            
            // 2. On passe les métadonnées (titre_court, statut) à la sauvegarde
            const result = await Drive.saveFile(currentFileId, fileName, content, targetFolder, meta);
            
            if (!currentFileId && result.id) currentFileId = result.id;
            alert("✅ Sauvegardé !");
        } catch (err) {
            console.error(err);
            alert("Erreur sauvegarde.");
        } finally {
            btnSave.innerHTML = originalText;
            btnSave.disabled = false;
        }
    });
});

// --- HELPERS ---

async function refreshProjects() {
    if (!Auth.isReady()) return;
    projectsGrid.innerHTML = '<div class="col-span-full text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-indigo-600 text-3xl"></i></div>';
    
    try {
        const conf = Config.get();
        const folderId = conf ? conf.folderId : null;
        const files = await Drive.listProjects(folderId);
        renderProjects(files);
    } catch (err) {
        if (err.status === 401) { Auth.signOut(); updateAppUI(false); }
        projectsGrid.innerHTML = '<p class="text-red-500 text-center col-span-full">Erreur chargement.</p>';
    }
}

function renderProjects(files) {
    projectsGrid.innerHTML = '';
    
    // On sépare les actifs des obsolètes pour l'affichage (optionnel, ou juste style)
    // Ici on affiche tout mais on style différemment.
    
    if (!files || files.length === 0) {
        projectsGrid.innerHTML = '<div class="col-span-full text-center text-slate-400 italic py-10">Dossier vide.</div>';
        return;
    }
    
    files.forEach(file => {
        // Extraction des propriétés Drive (sauvegardées via le YAML)
        const props = file.properties || {};
        const shortTitle = props.titre_court || null;
        const isObsolete = props.statut === 'obsolete';
        
        // Nom du fichier technique
        const filename = file.name.replace('.md', '');
        const date = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString('fr-FR') : '';

        // Styles dynamiques
        const opacityClass = isObsolete ? 'opacity-50 grayscale hover:grayscale-0' : '';
        const borderClass = isObsolete ? 'border-slate-100' : 'border-slate-200 hover:border-indigo-300';
        const badgeColor = isObsolete ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-700';
        const badgeText = isObsolete ? 'OBSOLÈTE' : 'FSA';

        // Logique d'affichage Titre : Si Titre Court existe, il est en gros, le filename en petit. Sinon l'inverse.
        let titleHtml = '';
        if (shortTitle) {
            titleHtml = `
                <h3 class="font-bold text-lg text-slate-800 group-hover:text-indigo-600 truncate">${shortTitle}</h3>
                <p class="text-xs text-slate-400 font-mono mt-1 truncate" title="${filename}">${filename}</p>
            `;
        } else {
            titleHtml = `
                <h3 class="font-bold text-lg text-slate-800 group-hover:text-indigo-600 truncate">${filename}</h3>
            `;
        }

        const card = document.createElement('div');
        card.className = `bg-white p-6 rounded-xl shadow-sm cursor-pointer transition group flex flex-col h-48 ${borderClass} ${opacityClass}`;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="${badgeColor} text-xs font-bold px-2 py-1 rounded uppercase">${badgeText}</span>
                <i class="fa-regular fa-file-lines text-slate-300 group-hover:text-indigo-500"></i>
            </div>
            <div class="mb-2 overflow-hidden">
                ${titleHtml}
            </div>
            <div class="flex-1"></div>
            <div class="mt-2 text-xs text-slate-400 pt-3 border-t border-slate-50">Modifié le ${date}</div>
        `;
        
        card.addEventListener('click', async () => {
            card.style.opacity = '0.5';
            try {
                const content = await Drive.getFileContent(file.id);
                currentFileId = file.id;
                Editor.setContent(content);
                
                // On update aussi l'état du bouton archiver dans l'éditeur
                const btnArchive = document.getElementById('lbl-archive').parentElement;
                if (isObsolete) {
                    btnArchive.innerHTML = '<i class="fa-solid fa-box-open mr-1"></i> <span id="lbl-archive">Restaurer</span>';
                    btnArchive.classList.add('text-orange-600');
                } else {
                    btnArchive.innerHTML = '<i class="fa-solid fa-box-archive mr-1"></i> <span id="lbl-archive">Archiver</span>';
                    btnArchive.classList.remove('text-orange-600');
                }

                showEditor(true);
            } catch(e) { alert("Erreur ouverture"); }
            finally { card.style.opacity = isObsolete ? '0.5' : '1'; }
        });
        projectsGrid.appendChild(card);
    });
}

function updateAppUI(isLoggedIn) {
    if (isLoggedIn) {
        btnNewProject.classList.remove('hidden');
        emptyState.classList.add('hidden');
    } else {
        btnNewProject.classList.add('hidden');
        projectsGrid.innerHTML = '';
        emptyState.classList.remove('hidden');
    }
}

function showEditor(show) {
    if (show) {
        viewDashboard.classList.add('hidden');
        viewEditor.classList.remove('hidden');
    } else {
        viewDashboard.classList.remove('hidden');
        viewEditor.classList.add('hidden');
    }
}