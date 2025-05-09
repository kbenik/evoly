// js/main.js
const App = (() => {
    let currentCollectionId = null;
    let currentViewedEntriesForNav = []; 
    let currentEntryIndexForNav = -1;   

    function init() {
        if (!localStorage.getItem('users')) localStorage.setItem('users', JSON.stringify([]));
        if (!localStorage.getItem('collections')) localStorage.setItem('collections', JSON.stringify([]));

        setupEventListeners();

        if (Auth.initAuth()) { 
            Collections.renderCollectionsDashboard();
            VisionService.ensureModelLoaded(); // Start loading TFJS model in background
        } else {
            Helpers.showView('signup-view'); 
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
            VisionService.ensureModelLoaded(); // Also ensure model loads on new signup/login
            event.target.reset();
        }
    }

    function handleLogout() {
        Auth.logout();
        Helpers.showView('signup-view');
        Helpers.getElement('#signup-form').reset(); 
    }
    
    async function handleImageInputChange(event, formTypePrefix) {
        const file = event.target.files[0];
        const imagePreview = Helpers.getElement(`#${formTypePrefix}-image-preview`);
        const dateInput = Helpers.getElement(`#${formTypePrefix === 'collection' ? 'collection-entry-date' : 'entry-date'}`);
        const dateMessage = Helpers.getElement(`#${formTypePrefix}-date-message`);
        const tagsInput = Helpers.getElement(`#${formTypePrefix}-tags`);
        const suggestedTagsContainer = Helpers.getElement(`#suggested-tags-${formTypePrefix}`);

        // Clear previous state
        imagePreview.style.display = 'none';
        imagePreview.src = '#';
        dateInput.value = '';
        dateMessage.textContent = 'Please choose a date.';
        if (tagsInput) tagsInput.value = '';
        if (suggestedTagsContainer) suggestedTagsContainer.innerHTML = '';

        if (!file) return; // No file selected

        imagePreview.src = URL.createObjectURL(file);
        imagePreview.style.display = 'block';
        // No need to revoke Object URL immediately in onload, it can be done after processing if needed, or browser handles it.

        // EXIF Date processing
        dateMessage.textContent = 'Processing image for date...';
        try {
            const exifDate = await ExifService.getExifDateTime(file);
            if (exifDate) {
                dateInput.value = Helpers.formatDateForInput(new Date(exifDate));
                dateMessage.textContent = 'Date auto-filled from image metadata.';
            } else {
                dateMessage.textContent = 'Could not read date from image. Please choose a date.';
            }
        } catch (exifError) {
            console.error("Error reading EXIF data:", exifError);
            dateMessage.textContent = 'Error getting date. Please choose a date.';
        }

        // Suggested Tags (TensorFlow.js)
        // Wait for the image preview to be fully loaded before passing to TF.js
        imagePreview.onload = async () => {
            URL.revokeObjectURL(imagePreview.src); // Revoke here after it's loaded and potentially processed

            if (suggestedTagsContainer) suggestedTagsContainer.innerHTML = '<i>Generating tag suggestions (AI)...</i>';
            try {
                const suggestedTags = await VisionService.processImageForTags(imagePreview);
                
                if (suggestedTagsContainer) suggestedTagsContainer.innerHTML = ''; // Clear loading message
                
                if (tagsInput && suggestedTags.length > 0) {
                    tagsInput.value = suggestedTags.join(', ');
                }

                if (suggestedTags.length > 0 && suggestedTagsContainer) {
                    const p = document.createElement('p');
                    p.style.marginBottom = '5px';
                    p.innerHTML = "<strong>Suggested by AI:</strong> (click to add/remove from input)";
                    suggestedTagsContainer.appendChild(p);

                    suggestedTags.forEach(tag => {
                        const tagChip = document.createElement('span');
                        tagChip.className = 'tag-chip suggested';
                        tagChip.textContent = tag;
                        tagChip.onclick = () => {
                            let currentTags = tagsInput.value.split(',')
                                                   .map(t => t.trim().toLowerCase()) // Work with lowercase for comparison
                                                   .filter(t => t.length > 0);
                            const lowerTag = tag.toLowerCase();
                            
                            if (currentTags.includes(lowerTag)) {
                                // Remove the tag (case-insensitive)
                                const originalTags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
                                tagsInput.value = originalTags.filter(ot => ot.toLowerCase() !== lowerTag).join(', ');
                            } else {
                                // Add the tag
                                const currentInputVal = tagsInput.value.trim();
                                if (currentInputVal.length > 0 && !currentInputVal.endsWith(',')) {
                                    tagsInput.value += ', ' + tag;
                                } else if (currentInputVal.length > 0 && currentInputVal.endsWith(',')){
                                    tagsInput.value += ' ' + tag;
                                }
                                 else {
                                    tagsInput.value = tag;
                                }
                            }
                             // Normalize comma spacing
                            tagsInput.value = tagsInput.value.split(',').map(t => t.trim()).filter(t => t).join(', ');
                        };
                        suggestedTagsContainer.appendChild(tagChip);
                    });
                } else if (suggestedTagsContainer) {
                     suggestedTagsContainer.innerHTML = '<p>No specific tags suggested by AI.</p>';
                }
            } catch (visionError) {
                console.error("Error processing image for tags:", visionError);
                if (suggestedTagsContainer) suggestedTagsContainer.innerHTML = '<p>Could not generate AI tags.</p>';
            }
        };
        imagePreview.onerror = () => {
            URL.revokeObjectURL(imagePreview.src);
            Helpers.showAlert("Error loading image preview.", "error");
            if (suggestedTagsContainer) suggestedTagsContainer.innerHTML = ''; // Clear if error
            dateMessage.textContent = 'Image load error. Please choose a date.';
        };
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
        
        const saveButton = Helpers.getElement('#collection-form button[type="submit"]');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

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
                Helpers.getElement('#collection-image-preview').src = '#';
                Helpers.getElement('#suggested-tags-collection').innerHTML = '';
                Helpers.getElement('#collection-date-message').textContent = '';
                Entries.renderCollectionTimeline(collection.id);
            }
        } catch (error) {
            Helpers.showAlert('Error saving collection. Storage might be full or image processing failed.', 'error');
            console.error("Error saving collection:", error);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Collection';
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

        const saveButton = Helpers.getElement('#entry-form button[type="submit"]');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        try {
            const imageBase64 = await Helpers.fileToBase64(imageFile);
            const resizedImageBase64 = await Helpers.resizeImage(imageBase64);

            const entryData = { title, notes, tags, imageUrl: resizedImageBase64, date };

            if (Entries.addEntry(collectionIdForEntry, entryData)) {
                event.target.reset();
                Helpers.getElement('#entry-image-preview').style.display = 'none';
                Helpers.getElement('#entry-image-preview').src = '#';
                Helpers.getElement('#suggested-tags-entry').innerHTML = '';
                Helpers.getElement('#entry-date-message').textContent = '';
                Entries.renderCollectionTimeline(collectionIdForEntry);
            }
        } catch (error) {
            Helpers.showAlert('Error saving entry. Storage might be full or image processing failed.', 'error');
            console.error("Error saving entry:", error);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Entry';
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
            currentViewedEntriesForNav = entriesArray; 
            currentEntryIndexForNav = entryIndex;
        }
    };
})();

document.addEventListener('DOMContentLoaded', App.init);
