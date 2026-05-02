/**
 * Flyer Storage Utilities
 * Handles persistence of AI-generated flyer variants using the Admin RLS Bypass proxy.
 */

export const flyerStorage = {
  /**
   * Fetches all custom flyers from the database
   * @returns {Promise<Array>} List of flyers sorted by newest first
   */
  async fetchCustomFlyers() {
    const res = await fetch('/api/admin/custom-flyers', { method: 'GET' });
    if (!res.ok) {
      console.error("Error fetching custom flyers:", await res.text());
      return [];
    }
    const { data } = await res.json();
    if (!data) return [];

    // Map database snake_case to frontend camelCase
    return data.map(row => ({
      id: row.id,
      sourceId: row.source_id,
      html: row.html_content,
      config: row.config,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },

  /**
   * Upserts a custom flyer variant along with its config
   * @param {Object} flyer - { id, sourceId, html }
   * @param {Object} config - The configuration state (escuela, fechaISO, etc.)
   */
  async saveCustomFlyer(flyer, config) {
    const res = await fetch('/api/admin/custom-flyers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        payload: { flyer, config }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Error saving custom flyer:", errText);
      throw new Error(errText);
    }
    return true;
  },

  /**
   * Updates only the configuration JSON of an existing flyer
   * @param {string} id - The unique ID of the variant
   * @param {Object} newConfig - The updated full config object
   */
  async updateFlyerConfig(id, newConfig) {
    const res = await fetch('/api/admin/custom-flyers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateConfig',
        payload: { id, config: newConfig }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Error updating flyer config:", errText);
      throw new Error(errText);
    }
    return true;
  },

  /**
   * Deletes a flyer from the database
   * @param {string} id - The unique ID of the variant
   */
  async deleteCustomFlyer(id) {
    const res = await fetch(`/api/admin/custom-flyers?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Error deleting custom flyer:", errText);
      throw new Error(errText);
    }
    return true;
  }
};
