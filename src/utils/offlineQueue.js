
const QUEUE_KEY = 'flyhigh_offline_queue';

export const saveOfflineEvent = (event) => {
    try {
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        queue.push({ ...event, localParams: { ...event.payload }, timestamp: Date.now() });
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) { console.error('Error saving to offline queue', e); }
};

export const getOfflineQueue = () => {
    try {
        return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch (e) { return []; }
};

export const clearOfflineQueue = () => {
    localStorage.removeItem(QUEUE_KEY);
};

export const removeEventFromQueue = (timestamp) => {
    try {
        let queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        queue = queue.filter(e => e.timestamp !== timestamp);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) { }
};
