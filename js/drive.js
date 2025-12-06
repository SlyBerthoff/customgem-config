/**
 * js/drive.js
 * Gestion Drive avec Métadonnées (Properties)
 */

export const Drive = {
    /**
     * Liste les projets (Récupère aussi 'properties' pour le titre court/statut)
     */
    async listProjects(folderId = null) {
        const parentQuery = folderId ? ` and '${folderId}' in parents` : "";
        const query = `mimeType = 'text/markdown' and trashed = false${parentQuery}`;

        try {
            const response = await gapi.client.drive.files.list({
                'pageSize': 50,
                // AJOUT DU CHAMP 'properties' ICI
                'fields': "files(id, name, modifiedTime, properties)",
                'q': query,
                'orderBy': 'modifiedTime desc'
            });
            return response.result.files || [];
        } catch (err) {
            console.error("Erreur Drive listProjects:", err);
            throw err;
        }
    },

    async listFolders(parentId = 'root') {
        const query = `mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
        try {
            const response = await gapi.client.drive.files.list({
                'pageSize': 50,
                'fields': "files(id, name)",
                'q': query,
                'orderBy': 'name'
            });
            return response.result.files || [];
        } catch (err) {
            throw err;
        }
    },

    async getFileContent(fileId) {
        try {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            return response.body;
        } catch (err) {
            throw err;
        }
    },

    /**
     * Sauvegarde avec Properties (Métadonnées custom)
     */
    async saveFile(fileId, title, content, parentFolderId = null, customProperties = {}) {
        const metadata = {
            'name': title,
            'mimeType': 'text/markdown',
            // ON INJECTE LES MÉTADONNÉES ICI
            'properties': customProperties
        };

        if (!fileId && parentFolderId) {
            metadata.parents = [parentFolderId];
        }

        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: text/markdown\r\n\r\n' +
            content +
            close_delim;

        const method = fileId ? 'PATCH' : 'POST';
        const path = '/upload/drive/v3/files' + (fileId ? '/' + fileId : '');

        try {
            const response = await gapi.client.request({
                'path': path,
                'method': method,
                'params': {'uploadType': 'multipart'},
                'headers': {
                    'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                },
                'body': multipartRequestBody
            });

            return response.result;
        } catch (err) {
            console.error("Erreur saveFile:", err);
            throw err;
        }
    }
};