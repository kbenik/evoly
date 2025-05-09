// js/utils/vision.js
const VisionService = (() => {
    async function processImageForTags(imageFile) {
        // Simulate API call or on-device model processing with a delay
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400));

        let potentialTags = [];
        if (imageFile && imageFile.name) {
            // Attempt to extract tags from filename (very basic heuristic)
            const nameWithoutExtension = imageFile.name.split('.').slice(0, -1).join('.');
            potentialTags = nameWithoutExtension
                .replace(/[\W_]+/g, ' ') // Replace non-alphanumeric with space
                .split(/\s+/)
                .filter(tag => tag.length > 2 && tag.length < 15 && !/^\d+$/.test(tag)) // Filter short/long/numeric words
                .map(tag => tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()); // Capitalize
        }
        
        // Some generic mock tags for variety
        const mockBank = ["Nature", "Outdoor", "Scenery", "일상", "Daily", "기록", "Sky", "Plant", "Photo", "Moment", "Capture", "Urban", "Food", "Art"];
        
        // Combine and shuffle
        let suggestedTags = [...new Set([...potentialTags, ...mockBank])];
        suggestedTags = suggestedTags.sort(() => 0.5 - Math.random()); 

        // Return a small, random selection of tags
        return suggestedTags.slice(0, Math.min(suggestedTags.length, 2 + Math.floor(Math.random() * 3)));
    }

    return {
        processImageForTags
    };
})();