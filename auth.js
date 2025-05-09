// js/auth.js
const Auth = (() => {
    const USERS_KEY = 'users';
    const CURRENT_USER_ID_KEY = 'currentUserId';

    function _getUsers() {
        const usersData = localStorage.getItem(USERS_KEY);
        return usersData ? JSON.parse(usersData) : [];
    }

    function _saveUsers(users) {
        try {
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                Helpers.showAlert('Storage full! Cannot save user data.', 'error', 5000);
            } else {
                Helpers.showAlert('Error saving user data.', 'error');
            }
            console.error("Error saving users:", e);
        }
    }

    // Simple obfuscation, not cryptographically secure hashing.
    function _hashPassword(password) {
        // This is a placeholder. For a real app, use a proper library like bcrypt or Argon2 (via WebAssembly or server-side).
        // For client-side only, this just makes it not plain text.
        try {
            return btoa(password + 'eVoLy$aLt!2024'); // Base64 encoding with a "salt"
        } catch (e) { // btoa can fail with certain characters
            console.warn("btoa failed for password, using plain password for storage (not recommended).");
            return password + 'eVoLy$aLt!2024';
        }
    }

    function signUp(username, phone, email, password) {
        if (!username || !phone || !email || !password) {
            Helpers.showAlert('All fields are required for sign up.', 'error');
            return false;
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            Helpers.showAlert('Invalid email format.', 'error');
            return false;
        }

        const users = _getUsers();
        if (users.find(user => user.username.toLowerCase() === username.toLowerCase())) {
            Helpers.showAlert('Username already exists.', 'error');
            return false;
        }
        if (users.find(user => user.email.toLowerCase() === email.toLowerCase())) {
            Helpers.showAlert('Email already registered.', 'error');
            return false;
        }

        const newUser = {
            id: Helpers.generateId(),
            username: username, // Store as entered, comparison is case-insensitive
            phone,
            email: email, // Store as entered
            hashedPassword: _hashPassword(password)
        };

        users.push(newUser);
        _saveUsers(users);
        
        localStorage.setItem(CURRENT_USER_ID_KEY, newUser.id);
        Helpers.showAlert(`Account for ${username} created successfully!`, 'success');
        return true;
    }

    function getCurrentUserId() {
        return localStorage.getItem(CURRENT_USER_ID_KEY);
    }

    function getCurrentUser() {
        const userId = getCurrentUserId();
        if (!userId) return null;
        const users = _getUsers();
        return users.find(user => user.id === userId) || null;
    }

    function logout() {
        localStorage.removeItem(CURRENT_USER_ID_KEY);
        Helpers.showAlert('Logged out successfully.', 'success');
        // App.init() will be called by main.js or listener to redirect
    }
    
    function initAuth() {
        const currentUserId = getCurrentUserId();
        if (currentUserId) {
            const user = getCurrentUser();
            if (user) {
                return true; // User is logged in
            } else {
                // Invalid/stale currentUserId, clear it
                localStorage.removeItem(CURRENT_USER_ID_KEY);
                Helpers.showView('signup-view');
                return false;
            }
        } else {
            Helpers.showView('signup-view');
            return false;
        }
    }

    return {
        signUp,
        getCurrentUser,
        getCurrentUserId,
        logout,
        initAuth
    };
})();