// js/utils/helpers.js
const Helpers = (() => {
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    function showView(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
        });
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.style.display = 'block';
            window.scrollTo(0, 0); // Scroll to top when view changes
        } else {
            console.error(`View with id ${viewId} not found.`);
        }
    }

    function getElement(selector) {
        return document.querySelector(selector);
    }

    function getElements(selector) {
        return document.querySelectorAll(selector);
    }

    async function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    async function resizeImage(base64Str, maxWidth = 800, maxHeight = 800, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * maxWidth / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * maxHeight / height);
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (err) => {
                console.error("Image loading error for resize:", err);
                reject("Error loading image for resizing.");
            };
        });
    }

    function showAlert(message, type = 'error', duration = 3000) {
        const alertContainer = getElement('#alert-container');
        if (!alertContainer) {
            console.warn("Alert container not found. Message:", message);
            return;
        }

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.remove();
        }, duration);
    }
    
    function formatDateForInput(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return ''; // Invalid date
        const year = d.getFullYear();
        const month = ('0' + (d.getMonth() + 1)).slice(-2);
        const day = ('0' + d.getDate()).slice(-2);
        return `${year}-${month}-${day}`;
    }

    function displayDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }; // Use UTC to avoid timezone shifts from input
        return date.toLocaleDateString(undefined, options);
    }

    function getDaysSince(newerDateStr, olderDateStr) {
        if (!newerDateStr || !olderDateStr) return null;
        const dNew = new Date(newerDateStr);
        const dOld = new Date(olderDateStr);
        if (isNaN(dNew.getTime()) || isNaN(dOld.getTime())) return null;
        
        // Normalize to UTC midnight to compare dates accurately
        const utcNew = Date.UTC(dNew.getUTCFullYear(), dNew.getUTCMonth(), dNew.getUTCDate());
        const utcOld = Date.UTC(dOld.getUTCFullYear(), dOld.getUTCMonth(), dOld.getUTCDate());

        const diffTime = utcNew - utcOld;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
        generateId,
        showView,
        getElement,
        getElements,
        fileToBase64,
        resizeImage,
        showAlert,
        formatDateForInput,
        displayDate,
        getDaysSince
    };
})();