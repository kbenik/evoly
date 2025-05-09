// js/entries.js
const Entries = (() => {

    function renderCollectionTimeline(collectionId) {
        App.setCurrentCollectionId(collectionId);
        const collection = Collections.getCollectionById(collectionId);
        if (!collection) {
            Helpers.showAlert('Collection not found.', 'error');
            Collections.renderCollectionsDashboard();
            return;
        }

        Helpers.getElement('#timeline-collection-name').textContent = collection.name;
        const entriesListDiv = Helpers.getElement('#entries-list');
        entriesListDiv.innerHTML = '';

        const sortedEntries = [...collection.entries].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        App.setCurrentEntryContext(null, sortedEntries, -1);

        if (sortedEntries.length === 0) {
            entriesListDiv.innerHTML = '<p>No entries yet in this collection. Tap the "+" button to add one!</p>';
        } else {
            sortedEntries.forEach((entry, index) => {
                const card = document.createElement('div');
                card.className = 'entry-card';
                card.dataset.entryId = entry.id; // For easier selection if needed
                card.onclick = () => renderEntryDetail(collection.id, entry.id, sortedEntries, index);

                let daysSinceText = 'This is the first entry.';
                if (index === sortedEntries.length - 1) { // Oldest entry
                    if (sortedEntries.length > 1) {
                        daysSinceText = 'Oldest entry in this collection.';
                    }
                } else { // Not the oldest entry, so there is a "next" entry (which is previous in time)
                    const previousEntryInTime = sortedEntries[index + 1];
                    const days = Helpers.getDaysSince(entry.date, previousEntryInTime.date);
                    if (days !== null) {
                         daysSinceText = `${days} day${days === 1 ? '' : 's'} since last entry.`;
                    } else {
                        daysSinceText = "Error calculating days.";
                    }
                }


                const notesPreview = entry.notes ? entry.notes.substring(0, 80) + (entry.notes.length > 80 ? '…' : '') : 'No notes for this entry.';

                let tagsHTML = '';
                if (entry.tags && entry.tags.length > 0) {
                    tagsHTML = entry.tags.map(tag => `<span class="tag-chip">${Helpers.getElement('body').textContent = tag, Helpers.getElement('body').innerHTML}</span>`).join(' '); // Basic XSS protection
                } else {
                    tagsHTML = '<span class="tag-chip">No tags</span>';
                }
                
                const entryTitle = entry.title || 'Untitled Entry';

                card.innerHTML = `
                    <img src="${entry.imageUrl}" alt="${Helpers.getElement('body').textContent = entryTitle, Helpers.getElement('body').innerHTML}" class="thumbnail">
                    <h4>${Helpers.getElement('body').textContent = entryTitle, Helpers.getElement('body').innerHTML}</h4>
                    <div class="entry-card-meta">
                        <span class="days-since">${daysSinceText}</span>
                        <small>Date: ${Helpers.displayDate(entry.date)}</small>
                    </div>
                    <p class="notes-preview">${Helpers.getElement('body').textContent = notesPreview, Helpers.getElement('body').innerHTML}</p>
                    <div class="tag-chips">${tagsHTML}</div>
                `;
                entriesListDiv.appendChild(card);
            });
        }
        Helpers.getElement('#add-entry-fab').dataset.collectionId = collectionId;
        Helpers.showView('timeline-view');
    }

    function showAddEntryForm(collectionId) {
        if (!collectionId) {
            Helpers.showAlert("Error: No collection specified for new entry.", "error");
            return;
        }
        Helpers.getElement('#entry-form-title').textContent = 'Add New Entry';
        const form = Helpers.getElement('#entry-form');
        form.reset();
        Helpers.getElement('#entry-collection-id').value = collectionId;
        Helpers.getElement('#entry-id').value = '';
        Helpers.getElement('#entry-image-preview').style.display = 'none';
        Helpers.getElement('#entry-image-preview').src = '#';
        Helpers.getElement('#suggested-tags-entry').innerHTML = '';
        Helpers.getElement('#entry-date-message').textContent = '';
        Helpers.getElement('#entry-image').required = true;
        Helpers.getElement('#entry-date').required = true;

        Helpers.showView('entry-form-view');
    }

    function addEntry(collectionId, entryData) {
        const collections = JSON.parse(localStorage.getItem('collections')) || [];
        const collectionIndex = collections.findIndex(c => c.id === collectionId);

        if (collectionIndex === -1) {
            Helpers.showAlert('Collection not found. Cannot add entry.', 'error');
            return false;
        }

        const newEntry = {
            id: Helpers.generateId(),
            collectionId: collectionId,
            title: entryData.title || 'Untitled Entry',
            notes: entryData.notes,
            tags: entryData.tags || [],
            imageUrl: entryData.imageUrl, // Base64 string
            date: entryData.date // YYYY-MM-DD string
        };

        collections[collectionIndex].entries.push(newEntry);
        
        try {
            Collections._saveCollectionsToStorage(collections); // Use central save
            Helpers.showAlert('Entry added successfully!', 'success');
            return true;
        } catch (e) {
            // Error already handled by _saveCollectionsToStorage
            return false;
        }
    }

    function renderEntryDetail(collectionId, entryId, entriesArrayContext, entryIndexContext) {
        const collection = Collections.getCollectionById(collectionId);
        if (!collection) {
            Helpers.showAlert('Collection not found.', 'error'); return;
        }
        // Ensure entriesArrayContext is sorted newest first if passed
        const sortedEntriesForNav = entriesArrayContext 
            ? [...entriesArrayContext].sort((a,b) => new Date(b.date) - new Date(a.date))
            : [...collection.entries].sort((a,b) => new Date(b.date) - new Date(a.date));

        const currentEntryIndex = sortedEntriesForNav.findIndex(e => e.id === entryId);
        const entry = sortedEntriesForNav[currentEntryIndex];

        if (!entry) {
            Helpers.showAlert('Entry not found.', 'error'); 
            renderCollectionTimeline(collectionId); // Go back to timeline if entry is missing
            return;
        }

        App.setCurrentCollectionId(collectionId);
        App.setCurrentEntryContext(entryId, sortedEntriesForNav, currentEntryIndex);

        const entryTitle = entry.title || 'Untitled Entry';
        Helpers.getElement('#entry-detail-image').src = entry.imageUrl;
        Helpers.getElement('#entry-detail-image').alt = entryTitle;
        Helpers.getElement('#entry-detail-title').textContent = entryTitle;
        Helpers.getElement('#entry-detail-date').textContent = Helpers.displayDate(entry.date);
        
        const tagsContainer = Helpers.getElement('#entry-detail-tags');
        tagsContainer.innerHTML = '';
        if (entry.tags && entry.tags.length > 0) {
            entry.tags.forEach(tag => {
                const chip = document.createElement('span');
                chip.className = 'tag-chip';
                // Basic XSS protection for tags
                chip.textContent = tag; 
                tagsContainer.appendChild(chip);
            });
        } else {
            tagsContainer.innerHTML = '<span class="tag-chip">No tags</span>';
        }

        const notesDiv = Helpers.getElement('#entry-detail-notes');
        notesDiv.innerHTML = ''; // Clear previous notes
        if (entry.notes) {
            // Basic "markdown-style" (paragraphs for newlines)
            // Sanitize notes content before inserting as HTML
            entry.notes.split('\n').forEach(paragraphText => {
                const p = document.createElement('p');
                p.textContent = paragraphText; // Use textContent to prevent XSS
                notesDiv.appendChild(p);
            });
        } else {
            notesDiv.innerHTML = '<p><em>No notes for this entry.</em></p>';
        }

        Helpers.getElement('#prev-entry-btn').style.display = (currentEntryIndex > 0) ? 'inline-block' : 'none';
        Helpers.getElement('#next-entry-btn').style.display = (currentEntryIndex < sortedEntriesForNav.length - 1) ? 'inline-block' : 'none';
        
        Helpers.showView('entry-detail-view');
    }

    return {
        renderCollectionTimeline,
        showAddEntryForm,
        addEntry,
        renderEntryDetail
    };
})();

// Simple XSS protection for entry card HTML generation
// This is a very basic approach. For robust protection, a proper sanitizer library is recommended.
(function() {
    const tempElem = document.createElement('div');
    function escapeHTML(html) {
        tempElem.textContent = html;
        return tempElem.innerHTML;
    }
    // Overwrite in Entries if needed, or use in a more central place
    // For now, textContent is used in most places which is safer.
    // The map for tags and entry.title in renderCollectionTimeline was updated to use a similar trick.
})();
