// js/main.js
const App = (() => {
    let currentCollectionId = null;
    let currentViewedEntriesForNav = []; // Array of entries for current timeline/detail view
    let currentEntryIndexForNav = -1;   // Index in currentViewedEntriesForNav

    function init() {
        // Initialize localStorage if keys don't exist (defensive)
        if (!localStorage.getItem('users')) localStorage.setItem('users', JSON.stringify([]));
        if (!localStorage.getItem('collections')) localStorage.setItem('collections', JSON.stringify([]));

        setupEventListeners();

        if (Auth.initAuth()) { // Checks token and shows dashboard if valid
            Collections.renderCollectionsDashboard();
        } else {
            Helpers.showView('signup-view'); // Default to signup if no valid session
        }
    }

    function setupEventListeners() {
        // Auth
        Helpers.getElement('#signup-form').addEventListener('submit', handleSignup);
        Helpers.getElement('#logout-btn').addEventListener('click', handleLogout);

        // Collections
        Helpers.getElement('#new-collection-btn').addEventListener('click', () => Collections.showCreateCollectionForm());
        Helpers.getElement('#collection-form').addEventListener('submit', handleSaveCollection);
        Helpers.getElement('#cancel-collection-form-btn').addEventListener('click', () => Collections.renderCollectionsDashboard());
        Helpers.getElement('#collection-image').addEventListener('change', (e) => handleImageInputChange(e, 'collection'));

        // Entries
        Helpers.getElement('#add-entry-fab').addEventListener('click', () => {
            const fabCollectionId = Helpers.getElement('#add-entry-fab').dataset.collectionId;
            if (fabCollectionId) Entries.showAddEntryForm(fabCollectionId);
        });
        Helpers.getElement('#entry-form').addEventListener('submit', handleSaveEntry);
        Helpers.getElement('#cancel-entry-form-btn').addEventListener('click', () => {
            if (currentCollectionId) Entries.renderCollectionTimeline(currentCollectionId);
            else Collections.renderCollectionsDashboard();
        });
        Helpers.getElement('#entry-image').addEventListener('change', (e) => handleImageInputChange(e, 'entry'));

        // Navigation
        Helpers.getElement('#back-to-dashboard-btn').addEventListener('click', () => Collections.renderCollectionsDashboard());
        Helpers.getElement('#back-to-timeline-btn').addEventListener('click', () => {
            if (currentCollectionId) Entries.renderCollectionTimeline(currentCollectionId);
        });
        
        // Entry Detail Navigation
        Helpers.getElement('#prev-entry-btn').addEventListener('click', navigateToPreviousEntry);
        Helpers.getElement('#next-entry-btn').addEventListener('click', navigateToNextEntry);
        document.addEventListener('keydown', handleGlobalKeydown);
    }

    function handleSignup(event) {
        event.preventDefault();
        const username = Helpers.getElement('#username').value.trim();
        const phone = Helpers.getElement('#phone').value.trim();
        const email = Helpers.getElement('#email').value.trim();
        const password = Helpers.getElement('#password').value;

        if (Auth.signUp(username, phone, email, password)) {
            Collections.renderCollectionsDashboard();
            event.target.reset();
        }
    }

    function handleLogout() {
        Auth.logout();
        Helpers.showView('signup-view'); // Show signup view after logout
        Helpers.getElement('#signup-form').reset(); // Clear signup form too
    }
    
    async function handleImageInputChange(event, formTypePrefix) {
        const file = event.target.files[0];
        if (!file) {
            // Clear previews and messages if file is deselected
            Helpers.getElement(`#${formTypePrefix}-image-preview`).style.display = 'none';
            Helpers.getElement(`#${formTypePrefix}-image-preview`).src = '#';
            const dateInput = Helpers.getElement(`#${formTypePrefix === 'collection' ? 'collection-entry-date' : 'entry-date'}`);
            dateInput.value = ''; // Clear date if no file
            Helpers.getElement(`#${formTypePrefix}-date-message`).textContent = 'Please choose a date.';
            Helpers.getElement(`#suggested-tags-${formTypePrefix}`).innerHTML = '';
            return;
        }

        const imagePreview = Helpers.getElement(`#${formTypePrefix}-image-preview`);
        const dateInput = Helpers.getElement(`#${formTypePrefix === 'collection' ? 'collection-entry-date' : 'entry-date'}`);
        const dateMessage = Helpers.getElement(`#${formTypePrefix}-date-message`);
        const tagsInput = Helpers.getElement(`#${formTypePrefix}-tags`); // e.g., #collection-tags or #entry-tags
        const suggestedTagsContainer = Helpers.getElement(`#suggested-tags-${formTypePrefix}`);

        imagePreview.src = URL.createObjectURL(file);
        imagePreview.style.display = 'block';
        imagePreview.onload = () => URL.revokeObjectURL(imagePreview.src);

        // EXIF Date
        dateMessage.textContent = 'Processing image for date...';
        const exifDate = await ExifService.getExifDateTime(file);
        if (exifDate) {
            dateInput.value = Helpers.formatDateForInput(new Date(exifDate));
            dateMessage.textContent = 'Date auto-filled from image metadata.';
        } else {
            // dateInput.value = ''; // Keep user input if they already set one, or clear: spec says "leave blank"
            dateMessage.textContent = 'Could not read date from image. Please choose a date.';
        }
        
        // Suggested Tags
        if (suggestedTagsContainer) suggestedTagsContainer.innerHTML = '<i>Generating tag suggestions...</i>';
        const suggestedTags = await VisionService.processImageForTags(file);
        
        if (suggestedTagsContainer) suggestedTagsContainer.innerHTML = ''; // Clear loading
        if (tagsInput) { // Pre-fill tags input with suggestions
            tagsInput.value = suggestedTags.join(', ');
        }

        if (suggestedTags.length > 0 && suggestedTagsContainer) {
            const p = document.createElement('p');
            p.style.marginBottom = '5px';
            p.innerHTML = "<strong>Suggested:</strong> (click to toggle in input)";
            suggestedTagsContainer.appendChild(p);
            suggestedTags.forEach(tag => {
                const tagChip = document.createElement('span');
                tagChip.className = 'tag-chip suggested';
                tagChip.textContent = tag;
                tagChip.onclick = () => {
                    let currentTags = tagsInput.value.split(',')
                                           .map(t => t.trim())
                                           .filter(t => t.length > 0);
                    if (currentTags.includes(tag)) {
                        currentTags = currentTags.filter(t => t !== tag);
                    } else {
                        currentTags.push(tag);
                    }
                    tagsInput.value = currentTags.join(', ');
                };
                suggestedTagsContainer.appendChild(tagChip);
            });
        } else if (suggestedTagsContainer) {
             suggestedTagsContainer.innerHTML = '<p>No specific tags suggested.</p>';
        }
    }

    async function handleSaveCollection(event) {
        event.preventDefault();
        const name = Helpers.getElement('#collection-name').value.trim();
        const imageFile = Helpers.getElement('#collection-image').files[0];
        const entryTitle = Helpers.getElement('#collection-entry-title').value.trim();
        const notes = Helpers.getElement('#collection-notes').value.trim();
        let tags = Helpers.getElement('#collection-tags').value.split(',').map(t => t.trim()).filter(t => t);
        const entryDate = Helpers.getElement('#collection-entry-date').value;

        if (!name) { Helpers.showAlert('Collection name is required.', 'error'); return; }
        if (!imageFile) { Helpers.showAlert('Kickoff photo is required.', 'error'); return; }
        if (!entryDate) { Helpers.showAlert('Entry date is required. If not in image, please select one.', 'error'); return; }
        
        Helpers.getElement('#collection-form button[type="submit"]').disabled = true;
        Helpers.getElement('#collection-form button[type="submit"]').textContent = 'Saving...';

        try {
            const imageBase64 = await Helpers.fileToBase64(imageFile);
            const resizedImageBase64 = await Helpers.resizeImage(imageBase64);

            const collection = Collections.createCollection(name, {
                title: entryTitle,
                notes: notes,
                tags: tags,
                imageUrl: resizedImageBase64,
                date: entryDate
            });

            if (collection) {
                event.target.reset();
                Helpers.getElement('#collection-image-preview').style.display = 'none';
                Helpers.getElement('#suggested-tags-collection').innerHTML = '';
                Helpers.getElement('#collection-date-message').textContent = '';
                Entries.renderCollectionTimeline(collection.id);
            }
        } catch (error) {
            Helpers.showAlert('Error saving collection. Storage might be full or image processing failed.', 'error');
            console.error("Error saving collection:", error);
        } finally {
            Helpers.getElement('#collection-form button[type="submit"]').disabled = false;
            Helpers.getElement('#collection-form button[type="submit"]').textContent = 'Save Collection';
        }
    }

    async function handleSaveEntry(event) {
        event.preventDefault();
        const collectionIdForEntry = Helpers.getElement('#entry-collection-id').value;
        const imageFile = Helpers.getElement('#entry-image').files[0];
        const title = Helpers.getElement('#entry-title').value.trim();
        const notes = Helpers.getElement('#entry-notes').value.trim();
        let tags = Helpers.getElement('#entry-tags').value.split(',').map(t => t.trim()).filter(t => t);
        const date = Helpers.getElement('#entry-date').value;

        if (!imageFile) { Helpers.showAlert('An image is required for the entry.', 'error'); return; }
        if (!date) { Helpers.showAlert('Entry date is required. If not in image, please select one.', 'error'); return; }
        if (!collectionIdForEntry) { Helpers.showAlert('Error: Collection ID missing.', 'error'); return; }

        Helpers.getElement('#entry-form button[type="submit"]').disabled = true;
        Helpers.getElement('#entry-form button[type="submit"]').textContent = 'Saving...';

        try {
            const imageBase64 = await Helpers.fileToBase64(imageFile);
            const resizedImageBase64 = await Helpers.resizeImage(imageBase64);

            const entryData = { title, notes, tags, imageUrl: resizedImageBase64, date };

            if (Entries.addEntry(collectionIdForEntry, entryData)) {
                event.target.reset();
                Helpers.getElement('#entry-image-preview').style.display = 'none';
                Helpers.getElement('#suggested-tags-entry').innerHTML = '';
                Helpers.getElement('#entry-date-message').textContent = '';
                Entries.renderCollectionTimeline(collectionIdForEntry);
            }
        } catch (error) {
            Helpers.showAlert('Error saving entry. Storage might be full or image processing failed.', 'error');
            console.error("Error saving entry:", error);
        } finally {
            Helpers.getElement('#entry-form button[type="submit"]').disabled = false;
            Helpers.getElement('#entry-form button[type="submit"]').textContent = 'Save Entry';
        }
    }

    function handleGlobalKeydown(event) {
        const entryDetailViewVisible = Helpers.getElement('#entry-detail-view').style.display === 'block';
        if (!entryDetailViewVisible) return;

        if (event.key === 'Escape') {
            if (currentCollectionId) Entries.renderCollectionTimeline(currentCollectionId);
        } else if (event.key === 'ArrowLeft') {
            navigateToPreviousEntry();
        } else if (event.key === 'ArrowRight') {
            navigateToNextEntry();
        }
    }

    function navigateToPreviousEntry() {
        if (currentEntryIndexForNav > 0) {
            currentEntryIndexForNav--;
            const prevEntry = currentViewedEntriesForNav[currentEntryIndexForNav];
            Entries.renderEntryDetail(prevEntry.collectionId, prevEntry.id, currentViewedEntriesForNav, currentEntryIndexForNav);
        }
    }
    
    function navigateToNextEntry() {
        if (currentEntryIndexForNav < currentViewedEntriesForNav.length - 1) {
            currentEntryIndexForNav++;
            const nextEntry = currentViewedEntriesForNav[currentEntryIndexForNav];
            Entries.renderEntryDetail(nextEntry.collectionId, nextEntry.id, currentViewedEntriesForNav, currentEntryIndexForNav);
        }
    }
    
    return {
        init,
        setCurrentCollectionId: (id) => currentCollectionId = id,
        setCurrentEntryContext: (entryId, entriesArray, entryIndex) => {
            // entryId is useful if we need to find the exact entry, but entryIndex and entriesArray are key for nav
            currentViewedEntriesForNav = entriesArray; // This array should be sorted (e.g. newest first)
            currentEntryIndexForNav = entryIndex;
        }
    };
})();

document.addEventListener('DOMContentLoaded', App.init);