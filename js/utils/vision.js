// js/utils/vision.js
const VisionService = (() => {
    let model = null;
    let modelLoadingPromise = null;

    async function loadModel() {
        if (model) return model;
        if (modelLoadingPromise) return modelLoadingPromise; // If already loading, return the promise

        console.log("Loading MobileNet model...");
        Helpers.showAlert("Loading image recognition model...", "warning", 5000); // Longer duration for model load

        modelLoadingPromise = mobilenet.load()
            .then(loadedModel => {
                model = loadedModel;
                console.log("MobileNet model loaded successfully.");
                Helpers.showAlert("Image model loaded!", "success", 2000);
                return model;
            })
            .catch(err => {
                console.error("Error loading MobileNet model:", err);
                Helpers.showAlert("Failed to load image model. Tag suggestions might be limited.", "error", 4000);
                modelLoadingPromise = null; // Reset promise on error
                return null; // Or throw err to propagate
            });
        return modelLoadingPromise;
    }

    async function processImageForTags(imageElement) {
        if (!imageElement || !(imageElement instanceof HTMLImageElement)) {
            console.warn("processImageForTags expects an HTMLImageElement.");
            return [];
        }
        if (!imageElement.complete || imageElement.naturalHeight === 0) {
            console.warn("Image not fully loaded for tag processing.");
            // Wait for image to load if it's not already
            await new Promise(resolve => {
                if (imageElement.complete && imageElement.naturalHeight !== 0) resolve();
                else {
                    imageElement.onload = resolve;
                    imageElement.onerror = resolve; // Resolve on error too to not hang
                }
            });
             if (!imageElement.complete || imageElement.naturalHeight === 0) {
                console.error("Image failed to load for tag processing.");
                return [];
             }
        }


        const loadedModel = await loadModel();
        if (!loadedModel) {
            // Fallback to very basic heuristic if model fails to load
            Helpers.showAlert("Using fallback tag suggestion due to model load issue.", "warning", 3000);
            return imageElement.alt ? imageElement.alt.split(' ').slice(0,3) : ["Image"];
        }

        try {
            console.log("Classifying image with MobileNet...");
            // Ensure the image is loaded
            if (!imageElement.complete || imageElement.naturalHeight === 0) {
                console.warn("Image not ready for classification.");
                return ["Image"]; // Default tag
            }

            const predictions = await loadedModel.classify(imageElement, 5); // Get top 5 predictions
            console.log("MobileNet Predictions:", predictions);

            const tags = predictions.map(p => {
                // className can be a comma-separated list, take the first part
                const mainClass = p.className.split(',')[0].trim();
                // Capitalize each word in the class name
                return mainClass.split(' ')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
            });
            
            return [...new Set(tags)].slice(0, 5); // Return unique tags, max 5

        } catch (error) {
            console.error("Error during image classification:", error);
            Helpers.showAlert("Error suggesting tags from image.", "error", 3000);
            // Fallback or simpler heuristic if TF.js fails
            const fallbackTags = ["Photo", "Capture"];
            if (imageElement.alt) {
                fallbackTags.unshift(...imageElement.alt.split(' ').slice(0,2));
            }
            return [...new Set(fallbackTags)];
        }
    }

    // Optional: Preload model when the app starts or when vision.js is first imported
    // loadModel(); // Uncomment to start loading model immediately

    return {
        processImageForTags,
        ensureModelLoaded: loadModel // Expose if needed to trigger loading early
    };
})();
