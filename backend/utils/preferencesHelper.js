export const ensurePreferences = (user) => {
    if (!user.preferences) {
      user.preferences = {};
    }
  
    if (!Array.isArray(user.preferences.countries)) {
      user.preferences.countries = [];
    }
  
    if (!Array.isArray(user.preferences.genres)) {
      user.preferences.genres = [];
    }
  
    if (!Array.isArray(user.preferences.moods)) {
      user.preferences.moods = [];
    }
  
    if (!Array.isArray(user.preferences.languages)) {
      user.preferences.languages = [];
    }
  
    if (!Array.isArray(user.preferences.years)) {
      user.preferences.years = [];
    }
  
    if (!Array.isArray(user.preferences.artists)) {
      user.preferences.artists = [];
    }
  
    return user.preferences;
  };
  
  const isValidPreferenceValue = (value) => {
    if (value === undefined || value === null || value === "") {
      return false;
    }
  
    const normalized = value.toString().trim().toLowerCase();
  
    if (
      normalized === "" ||
      normalized === "unknown" ||
      normalized === "undefined" ||
      normalized === "null"
    ) {
      return false;
    }
  
    return true;
  };
  
  export const increasePreference = (list, key, value, amount = 1) => {
    if (!Array.isArray(list)) return;
  
    if (!isValidPreferenceValue(value)) {
      return;
    }
  
    const existingItem = list.find(
      (item) => item[key]?.toString() === value.toString()
    );
  
    if (existingItem) {
      existingItem.score = Number(existingItem.score || 0) + Number(amount || 1);
    } else {
      list.push({
        [key]: value,
        score: Number(amount || 1),
      });
    }
  };
  
  export const decreasePreference = (list, key, value, amount = 1) => {
    if (!Array.isArray(list)) return;
  
    if (!isValidPreferenceValue(value)) {
      return;
    }
  
    const existingItem = list.find(
      (item) => item[key]?.toString() === value.toString()
    );
  
    if (!existingItem) return;
  
    existingItem.score = Math.max(
      0,
      Number(existingItem.score || 0) - Number(amount || 1)
    );
  };