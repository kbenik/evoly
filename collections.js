// js/collections.js
const Collections = (() => {
    const COLLECTIONS_KEY = 'collections';

    function _getCollectionsFromStorage() {
        const collectionsData = localStorage.getItem(COLLECTIONS_KEY);
        return collectionsData ? JSON.parse(collectionsData) : [];
    }

    function _saveCollectionsToStorage(collections) {
        try {
            localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                Helpers.showAlert('Storage full! Cannot save collection. Try removing large entries or collections.', 'error', 5000);
            } else {
                Helpers.showAlert('Error saving collections data.', 'error');
            }
            console.error("Error saving collections:", e);
            throw e; // Re-throw to allow calling function to know save failed
        }
    }

    function getUserCollections(userId) {
        const allCollections = _getCollectionsFromStorage();
        return allCollections.filter(collection => collection.userId === userId);
    }

    function getCollectionById(collectionId) {
        const allCollections = _getCollectionsFromStorage();
        return allCollections.find(collection => collection.id === collectionId);
    }

    function renderCollectionsDashboard() {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) {
            Helpers.showView('signup-view');
            return;
        }

        Helpers.getElement('#greeting').textContent = `Hello, ${currentUser.username}.`;
        const collectionsListDiv = Helpers.getElement('#collections-list');
        collectionsListDiv.innerHTML = ''; // Clear previous list

        const userCollections = getUserCollections(currentUser.id);

        if (userCollections.length === 0) {
            collectionsListDiv.innerHTML = '<p>No collections yet. Create one to get started!</p>';
        } else {
            userCollections.sort((a,b) => a.name.localeCompare(b.name)).forEach(collection => { // Sort alphabetically
                const button = document.createElement('button');
                button.className = 'collection-button';
                button.textContent = collection.name;
                button.onclick = () => Entries.renderCollectionTimeline(collection.id);
                collectionsListDiv.appendChild(button);
            });
        }
        Helpers.showView('dashboard-view');
    }

    function showCreateCollectionForm() {
        Helpers.getElement('#collection-form-title').textContent = 'Create New Collection';
        const form = Helpers.getElement('#collection-form');
        form.reset();
        Helpers.getElement('#collection-id').value = '';
        Helpers.getElement('#collection-image-preview').style.display = 'none';
        Helpers.getElement('#collection-image-preview').src = '#';
        Helpers.getElement('#suggested-tags-collection').innerHTML = '';
        Helpers.getElement('#collection-date-message').textContent = '';
        Helpers.getElement('#collection-image').required = true; 
        Helpers.getElement('#collection-entry-date').required = true;

        Helpers.showView('collection-form-view');
    }
    
    function _getUniqueCollectionName(name, userId) {
        const userCollections = getUserCollections(userId);
        let finalName = name;
        let counter = 1;
        // Check if a collection with this name (case-insensitive) already exists
        while (userCollections.some(c => c.name.toLowerCase() === finalName.toLowerCase())) {
            finalName = `${name}-${counter}`;
            counter++;
        }
        return finalName;
    }

    function createCollection(name, firstEntryData) {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) {
            Helpers.showAlert('No user logged in. Cannot create collection.', 'error');
            return null;
        }

        const uniqueName = _getUniqueCollectionName(name, currentUser.id);
        if (name.toLowerCase() !== uniqueName.toLowerCase()) {
            Helpers.showAlert(`A collection like "${name}" already exists. Renamed to "${uniqueName}".`, 'warning');
        }
        
        const collectionId = Helpers.generateId();
        const firstEntry = {
            id: Helpers.generateId(),
            collectionId: collectionId,
            title: firstEntryData.title || 'Kickoff Entry',
            notes: firstEntryData.notes,
            tags: firstEntryData.tags || [],
            imageUrl: firstEntryData.imageUrl, // Base64 string
            date: firstEntryData.date // YYYY-MM-DD string
        };

        const newCollection = {
            id: collectionId,
            userId: currentUser.id,
            name: uniqueName,
            entries: [firstEntry]
        };

        const collections = _getCollectionsFromStorage();
        collections.push(newCollection);
        try {
            _saveCollectionsToStorage(collections);
            Helpers.showAlert(`Collection "${uniqueName}" created successfully!`, 'success');
            return newCollection;
        } catch (e) {
            // Error already shown by _saveCollectionsToStorage
            return null;
        }
    }

    return {
        renderCollectionsDashboard,
        showCreateCollectionForm,
        createCollection,
        getCollectionById,
        getUserCollections,
        _saveCollectionsToStorage // Exposed for entries.js to update collections
    };
})();